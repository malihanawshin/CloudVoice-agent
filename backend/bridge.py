import sys
import asyncio
import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI  # <--- NEW IMPORT
from dotenv import load_dotenv

# MCP SDK Imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
load_dotenv()

app = FastAPI()

client = OpenAI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Query(BaseModel):
    prompt: str
    approved: bool = False

# --- MCP CLIENT ---
async def run_mcp_tool(instance_type: str, hours: int):
    server_params = StdioServerParameters(command=sys.executable, args=["server.py"], env=None)
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return (await session.call_tool("calculate_carbon_footprint", {"instance_type": instance_type, "hours": hours})).content[0].text

@app.post("/chat")
async def chat(query: Query):
    print(f"User: {query.prompt} | Approved: {query.approved}")

    # --- STEP 1: DEFINE TOOLS FOR OPENAI ---
    # This tells GPT "I have a tool that can do X"
    tools = [
        {
            "type": "function",
            "function": {
                "name": "calculate_carbon_footprint",
                "description": "Calculate CO2 emissions for a cloud instance. Use this when user asks about carbon, emissions, or sustainability.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "instance_type": {"type": "string", "enum": ["t3.medium", "m5.large", "gpu.large", "t3.nano"]},
                        "hours": {"type": "integer", "description": "Number of hours to run"}
                    },
                    "required": ["instance_type", "hours"]
                }
            }
        }
    ]

    try:
        # --- STEP 2: ASK GPT WHAT TO DO ---
        # If this is an Approval retry, force the context
        messages = [
            {"role": "system", "content": "You are CloudVoice, an intelligent infrastructure assistant. Be concise."},
            {"role": "user", "content": query.prompt}
        ]

        completion = client.chat.completions.create(
            model="gpt-4o", # or gpt-3.5-turbo
            messages=messages,
            tools=tools,
            tool_choice="auto" 
        )

        response_message = completion.choices[0].message

        # --- STEP 3: CHECK IF GPT WANTS TO USE A TOOL ---
        if response_message.tool_calls:
            tool_call = response_message.tool_calls[0]
            fn_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            
            instance_type = args.get("instance_type")
            hours = args.get("hours", 1) # Default to 1 if GPT forgets

            print(f"GPT decided to call tool: {fn_name} with {args}")

            # --- STEP 4: HUMAN-IN-THE-LOOP CHECK ---
            if "gpu" in instance_type and not query.approved:
                return {
                    "response": f"I noticed you requested {instance_type}. This has high emissions. Proceed?",
                    "requires_approval": True,
                    "pending_action": {"instance": instance_type, "hours": hours} # Data for button
                }

            # --- STEP 5: EXECUTE REAL MCP TOOL ---
            tool_result = await run_mcp_tool(instance_type, hours)
            
            # (Optional) Feed result BACK to GPT for a final natural sentence
            # For now, let's just return the result directly to save latency
            return {
                "response": f"I checked the agent. {tool_result}",
                "tool_used": "calculate_carbon_footprint",
                "data": {"instance": instance_type, "hours": hours, "footprint": tool_result}
            }

        else:
            # GPT didn't use a tool (Just normal chat)
            return {
                "response": response_message.content,
                "tool_used": None
            }

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
