import chromadb
from chromadb.utils import embedding_functions
import os
from dotenv import load_dotenv 

load_dotenv()

client = chromadb.PersistentClient(path="./knowledge_db")

openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small"
)

collection = client.get_collection(
    name="green_ai_docs", 
    embedding_function=openai_ef
)

def search_knowledge_base(query: str):
    """
    Semantic search using Vector Embeddings.
    """
    print(f"Vector Searching for: {query}")
    
    # Query the DB (returns top 1 result)
    results = collection.query(
        query_texts=[query],
        n_results=1
    )
    
    if results['documents'][0]:
        return results['documents'][0][0] # Return the text
    return None
