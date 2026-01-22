# CloudVoice Agent

## Project Overview

CloudVoice Agent is a research-oriented prototype designed to explore the intersection of Large Language Models (LLMs), speech processing, and sustainable infrastructure operations. This project implements a "Voice-Ops" system that allows users to manage cloud resources using natural language commands. It focuses on the reliability of agentic workflows, integrating Speech-to-Text (STT) systems with decision-making agents to optimize cloud deployments and monitor carbon emissions.

## Core Research Focus

This repository serves as a foundational platform for researching:
*   **Speech-driven AI Systems:** integrating high-fidelity audio transcription to handle technical domain logic and infrastructure commands.
*   **LLM Engineering:** implementing the Model Context Protocol (MCP) to decouple reasoning engines from execution tools, facilitating modular agent architectures.
*   **Human-in-the-Loop Workflows:** designing safety mechanisms for autonomous agents, specifically for high-stakes operational tasks like GPU provisioning.

## Screenshots
<img width="873" height="612" alt="Screenshot 2026-01-22 at 4 49 48 PM" src="https://github.com/user-attachments/assets/7ae51437-a849-43da-862d-086d55f118cf" />
<img width="864" height="614" alt="Screenshot 2026-01-22 at 4 43 54 PM" src="https://github.com/user-attachments/assets/b1a67ca8-2594-49d3-a641-ba142f6c7dd0" />


## Speech Processing Implementation

The system creates a seamless conversational interface through the integration of state-of-the-art audio processing models:

*   **Speech-to-Text (STT):** The agent utilizes **OpenAI Whisper** for transcribing user voice commands. This model was selected for its high accuracy in recognizing technical terminology and context-specific jargon (e.g., distinguishing specific server instance types), which is critical for operational reliability in industrial R&D settings.
*   **Text-to-Speech (TTS):** The architecture is designed to support bidirectional audio communication, allowing the agent to provide synthesized vocal feedback to the user, completing the full speech-driven interaction loop.

## Technology Stack

The project is built upon a modern, modular stack designed for scalability and research flexibility:

*   **Protocol:** Model Context Protocol (MCP) for standardizing tool interfaces.
*   **LLM:** OpenAI GPT-4o for reasoning, intent classification, and tool orchestration.
*   **Audio Processing:** OpenAI Whisper (v1) for automatic speech recognition.
*   **Backend:** Python and FastAPI for handling high-performance asynchronous request processing.
*   **Frontend:** React and TypeScript for the client-side interface and audio capture.

## Operational Workflow

1.  **Audio Capture:** The frontend captures raw audio input and transmits it to the backend.
2.  **Transcription:** The backend processes the audio stream using Whisper to generate a text prompt.
3.  **Reasoning:** The LLM analyzes the text to determine intent (e.g., carbon estimation vs. resource deployment).
4.  **Tool Execution:** Based on the intent, the Agent interacts with the MCP server to execute safe information retrieval or request authorization for sensitive actions.
5.  **RAG Integration:** Consults technical manuals for Green AI optimization advice.
