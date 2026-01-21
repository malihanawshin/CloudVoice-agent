import asyncio
from mcp.server.models import InitializationOptions
import mcp.types as types
from mcp.server import Server, NotificationOptions
from mcp.server.stdio import stdio_server

# 1. Initialize the Server
server = Server("CloudVoice-Agent")

# 2. Define the tool handler
@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="calculate_carbon_footprint",
            description="Calculates CO2 emissions for cloud instances",
            inputSchema={
                "type": "object",
                "properties": {
                    "instance_type": {"type": "string"},
                    "hours": {"type": "integer"},
                },
                "required": ["instance_type", "hours"],
            },
        ),
        types.Tool(
            name="deploy_instance",
            description="Actually deploy a cloud instance. REQUIRES APPROVAL for High Performance types.",
            inputSchema={
                "type": "object",
                "properties": {
                    "instance_type": {"type": "string"},
                    "hours": {"type": "integer"}
                },
                "required": ["instance_type"]
            },
        )
    ]

@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent]:
    if name == "deploy_instance":
        return [types.TextContent(type="text", text="DEPLOYMENT_INITIATED")]
    elif name == "calculate_carbon_footprint":
        # Extract arguments safely
        if not arguments:
            raise ValueError("Missing arguments")
        
        inst_type = arguments.get("instance_type", "unknown")
        try:
            hours = int(arguments.get("hours", 0))
        except ValueError:
            hours = 0 


        # Mock Logic
        emissions_map = {"t3.medium": 0.05, "gpu.large": 1.2}
        rate = emissions_map.get(inst_type, 0.1)
        total = rate * hours

        return [
            types.TextContent(
                type="text",
                text=f"{total:.2f} kg",
            )
        ]
    
    raise ValueError(f"Unknown tool: {name}")

# 3. Run the server using stdio transport
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="CloudVoice-Agent",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
