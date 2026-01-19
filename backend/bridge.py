import sys
import asyncio
import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI  
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

# GLOBAL MEMORY
history = [
    {"role": "system", "content": "You are CloudVoice. You have a tool to calculate carbon. Always ask for instance type and hours if missing. If the user says 'lodge', assume they mean 'large'. Be concise."}
]

@app.post("/chat")
async def chat(query: Query):
    global history 
    
    # 1. Add User's new message
    history.append({"role": "user", "content": query.prompt})

    print(f"User: {query.prompt} | Approved: {query.approved}")

    tools = [
        {
            "type": "function",
            "function": {
                "name": "calculate_carbon_footprint",
                "description": "Calculate CO2 emissions for a cloud instance.",
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
        # 2. Ask GPT
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=history,
            tools=tools,
            tool_choice="auto" 
        )

        response_message = completion.choices[0].message
        
        # 3. Add GPT's response to history
        history.append(response_message)

        # 4. Check Tool Use
        if response_message.tool_calls:
            tool_call = response_message.tool_calls[0]
            fn_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            
            instance_type = args.get("instance_type")
            hours = args.get("hours", 1)

            print(f"GPT decided to call tool: {fn_name} with {args}")

            # --- HUMAN-IN-THE-LOOP CHECK ---
            if "gpu" in instance_type and not query.approved:
                history.pop() 
                
                # Add a fake 'assistant' question instead to keep history clean
                question = f"I noticed you requested {instance_type}. This has high emissions. Proceed?"
                history.append({"role": "assistant", "content": question})
                
                return {
                    "response": question,
                    "requires_approval": True,
                    "pending_action": {"instance": instance_type, "hours": hours}
                }

            # --- EXECUTE REAL MCP TOOL ---
            tool_result = await run_mcp_tool(instance_type, hours)

            # Append result to history
            history.append({
                 "role": "tool", 
                 "tool_call_id": response_message.tool_calls[0].id, 
                 "content": tool_result
             })
            
            return {
                "response": f"I checked the infrastructure. {tool_result}",
                "tool_used": "calculate_carbon_footprint",
                "data": {"instance": instance_type, "hours": hours, "footprint": tool_result}
            }

        else:
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
