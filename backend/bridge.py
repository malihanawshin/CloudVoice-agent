import sys
import json
from fastapi import FastAPI, HTTPException, UploadFile, File
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
    # Ensure hours is an integer before sending
    server_params = StdioServerParameters(command=sys.executable, args=["server.py"], env=None)
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            # Pass arguments as a dictionary where hours is strictly an int
            return (await session.call_tool("calculate_carbon_footprint", {
                "instance_type": instance_type, 
                "hours": int(hours) 
            })).content[0].text

# GLOBAL MEMORY
history = [
    {"role": "system", "content": "You are CloudVoice. You have a tool to calculate carbon. Always ask for instance type and hours if missing. If the user says 'lodge', assume they mean 'large'. Be concise."}
]

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        # OpenAI expects a tuple (filename, file_object, content_type)
        transcript = client.audio.transcriptions.create(
            model="whisper-1", 
            file=("audio.webm", file.file, "audio/webm")
        )
        print(f"Transcribed: {transcript.text}")
        return {"text": transcript.text}
    except Exception as e:
        print(f"Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
                "description": "Calculate CO2 emissions for a cloud instance. Use for 'check', 'how much pollution', 'estimate'.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "instance_type": {"type": "string", "enum": ["t3.medium", "m5.large", "gpu.large", "t3.nano"]},
                        "hours": {"type": "integer", "description": "Number of hours to run"}
                    },
                    "required": ["instance_type", "hours"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "deploy_instance",
                "description": "Provision/Start a server. Use for 'deploy', 'start', 'spin up'.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "instance_type": {"type": "string", "enum": ["t3.medium", "m5.large", "gpu.large"]},
                        "hours": {"type": "integer"}
                    },
                    "required": ["instance_type"]
                }
            }
        },
        # RAG TOOL
        {
            "type": "function",
            "function": {
                "name": "consult_manual",
                "description": "Get technical advice on AI efficiency, model optimization, or Green AI practices.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string", "description": "The technical topic, e.g., 'quantization'"}
                    },
                    "required": ["topic"]
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
            
            # Extract arguments safely
            instance_type = args.get("instance_type")
            hours = args.get("hours", 0) # Default to 0 if missing
            
            print(f"GPT decided to call tool: {fn_name} with {args}")

            # ====================================================
            # TOOL 1: CARBON CALCULATOR
            # ====================================================
            if fn_name == "calculate_carbon_footprint":
                try:
                    # Pass specific arguments, not the whole dict
                    tool_result = await run_mcp_tool(instance_type, hours)
                except Exception as e:
                    tool_result = f"Error executing tool: {str(e)}"
                    print(f"MCP Tool Failed: {e}")

                # Append the result to history
                history.append({
                    "role": "tool", 
                    "tool_call_id": tool_call.id, 
                    "content": str(tool_result)
                })

                return {
                    "response": f"Estimated emissions: {tool_result}",
                    "tool_used": "calculate_carbon_footprint",
                    "data": {"instance": instance_type, "footprint": tool_result}
                }

            # ====================================================
            # TOOL 2: DEPLOY INSTANCE
            # ====================================================
            elif fn_name == "deploy_instance":
                if "gpu" in instance_type and not query.approved:
                    # PAUSE FOR APPROVAL
                    history.pop() # Remove the "Assistant: call tool" message so we can retry cleanly
                    msg = f"Deploying {instance_type} requires authorization. Proceed?"
                    history.append({"role": "assistant", "content": msg})
                    return {
                        "response": msg,
                        "requires_approval": True,
                        "pending_action": {"instance": instance_type, "tool": "deploy_instance"} 
                    }
                
                # IF APPROVED:
                # Add mock tool output to keep history consistent
                history.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": "DEPLOYMENT_INITIATED"
                })
                
                return {
                    "response": f"Deployment Initiated for {instance_type}. Monitoring started.",
                    "tool_used": "deploy_instance",
                    "data": None 
                }

            # ====================================================
            # TOOL 3: RAG / MANUAL SEARCH
            # ====================================================
            elif fn_name == "consult_manual":
                try:
                    from rag import search_knowledge_base 
                    
                    topic = args.get("topic")
                    print(f"Searching manual for: {topic}")
                    
                    # Run Tool
                    knowledge = search_knowledge_base(topic)
                    result_text = f"Found: {knowledge}" if knowledge else "I couldn't find that in the manual."
                    
                    # Append result to history
                    history.append({
                        "role": "tool", 
                        "tool_call_id": tool_call.id, 
                        "content": result_text
                    })
                    
                    # Ask GPT to summarize the finding
                    final_completion = client.chat.completions.create(
                        model="gpt-4o",
                        messages=history
                    )
                    final_msg = final_completion.choices[0].message
                    history.append(final_msg)
                    
                    return {
                        "response": final_msg.content,
                        "tool_used": "consult_manual",
                    }
                except ImportError:
                     # Handle case where rag.py doesn't exist yet
                     err_msg = "RAG module not found."
                     history.append({"role": "tool", "tool_call_id": tool_call.id, "content": err_msg})
                     return {"response": err_msg}

        # If no tool calls, just return the text
        else:
            return {
                "response": response_message.content,
                "tool_used": None
            }

    except Exception as e:
        print(f"Error: {e}")
        # Safety: If we crash during a tool call flow, pop the last message 
        # (which was likely the tool call) so the conversation isn't stuck.
        if history and history[-1].get("tool_calls"):
            history.pop()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
