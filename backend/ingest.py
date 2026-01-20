# ingest.py
import chromadb
from chromadb.utils import embedding_functions
import os
from dotenv import load_dotenv 

load_dotenv()

# Check if key exists 
if not os.getenv("OPENAI_API_KEY"):
    print("Error: OPENAI_API_KEY not found in environment.")
    exit(1)

openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small"
)

client = chromadb.PersistentClient(path="./knowledge_db")

# Pass the embedding function 
collection = client.get_or_create_collection(
    name="green_ai_docs", 
    embedding_function=openai_ef
)

# Knowledge: "Green AI" Best Practices
documents = [
    "To reduce LLM inference costs, use quantization (4-bit or 8-bit) which lowers memory usage by up to 75%.",
    "Retrieval-Augmented Generation (RAG) reduces hallucination but increases latency. Use caching to mitigate this.",
    "For speech-to-text efficiency, Whisper-tiny is 32x faster than Whisper-large but has higher error rates.",
    "Kubernetes autoscaling (HPA) should be configured based on GPU memory metrics, not just CPU usage.",
    "Distillation is a technique where a smaller 'student' model learns to mimic a larger 'teacher' model to save energy."
]
ids = [f"doc_{i}" for i in range(len(documents))]

# 3. Save Data (Chroma handles embedding automatically!)
collection.add(documents=documents, ids=ids)

print("Knowledge Base Created!")
