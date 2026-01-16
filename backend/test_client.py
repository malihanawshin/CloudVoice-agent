import asyncio
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def run():
    # This automatically uses the same Python environment you are running this script in
    server_params = StdioServerParameters(
        command=sys.executable, 
        args=["server.py"], 
        env=None 
    )

    print("🔌 Connecting to server...")
    
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # 1. Initialize the connection
                await session.initialize()
                
                # 2. Ask the server: "What tools do you have?"
                result = await session.list_tools()
                
                print(f"\n✅ SUCCESS! Connected to server.")
                print(f"📊 Found {len(result.tools)} tools:")
                
                for tool in result.tools:
                    print(f"   - Name: {tool.name}")
                    print(f"     Desc: {tool.description}")

                # 3. Test the tool if it exists
                if result.tools:
                    print("\n🧪 Testing tool execution...")
                    call_result = await session.call_tool(
                        "calculate_carbon_footprint", 
                        {"instance_type": "gpu.large", "hours": 10}
                    )
                    print(f"   Output: {call_result.content[0].text}")

    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: The server crashed or refused connection.")
        print(f"Error details: {e}")

if __name__ == "__main__":
    asyncio.run(run())
