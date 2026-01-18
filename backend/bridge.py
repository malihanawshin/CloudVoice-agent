import sys
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import MCP Client components
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

app = FastAPI()

# 1. Enable CORS for React
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

# 2. Helper function to talk to MCP Server
async def run_mcp_tool(instance_type: str, hours: int):
    # Configure the server parameters
    # We use the same python executable to run server.py
    server_params = StdioServerParameters(
        command=sys.executable, 
        args=["server.py"], 
        env=None 
    )

    # Start the conversation
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Check if tool exists (good practice)
            result = await session.list_tools()
            tool_names = [t.name for t in result.tools]
            
            if "calculate_carbon_footprint" not in tool_names:
                return {"error": "Tool not found on server"}

            # Call the tool
            # In a real agent, the LLM would construct these args.
            # Here we pass what we parsed from the user prompt.
            call_result = await session.call_tool(
                "calculate_carbon_footprint", 
                {"instance_type": instance_type, "hours": hours}
            )
            
            return {
                "text": call_result.content[0].text,
                "raw": call_result
            }

@app.post("/chat")
async def chat(query: Query):
    print(f"Received prompt: {query.prompt}")
    
    # 3. Simple Intent Parsing (Simulating an LLM Brain)
    # We extract variables from the prompt to pass to the tool.
    
    # Default values
    instance_type = "t3.medium"
    hours = 1
    
    prompt_lower = query.prompt.lower()
    
    # Parsing logic
    if "gpu" in prompt_lower:
        instance_type = "gpu.large"
    elif "large" in prompt_lower:
        instance_type = "m5.large"

    if "gpu" in instance_type and not query.approved:
        return {
            "response": "Deploying a GPU instance has a high carbon impact. Do you want to proceed?",
            "requires_approval": True,
            "pending_action": {
                "instance": instance_type,
                "hours": hours
            }
        }
        
    # Attempt to find numbers in the prompt for "hours"
    # e.g., "run for 5 hours"
    import re
    numbers = re.findall(r'\d+', prompt_lower)
    if numbers:
        hours = int(numbers[0])

    # 4. Execute the MCP Tool
    try:
        mcp_result = await run_mcp_tool(instance_type, hours)
        
        # 5. Format response for UI
        # We explicitly return 'data' so the Green Widget appears
        return {
            "response": f"I consulted the MCP Agent. {mcp_result['text']}",
            "tool_used": "calculate_carbon_footprint",
            "data": {
                "instance": instance_type, 
                "hours": hours,
                "footprint": mcp_result['text']
            }
        }
        
    except Exception as e:
        print(f"MCP Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
