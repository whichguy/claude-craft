# Project Plan: Enterprise RAG (Retrieval-Augmented Generation) Search

## Context
This project aims to build a high-performance, enterprise-grade RAG system capable of aggregating knowledge from disparate sources (PDFs, Notion, and Slack). The system will leverage state-of-the-art embedding models, vector databases, and orchestration frameworks to provide accurate, context-aware answers to user queries, backed by rigorous evaluation and observability.

## Git Setup
1. Initialize repository: `git init enterprise-rag-search`
2. Create `.gitignore` to exclude `.env`, `node_modules`, `__pycache__`, and temporary ingestion files.
3. Establish a `main` branch and a `develop` branch for feature integration.
4. Set up pre-commit hooks for linting (ruff/flake8) and type checking (mypy).

## Implementation Steps

### Phase 1: Environment & Scaffolding
**Intent:** Set up the core architecture, dependency management, and environment configuration.

- **Files:** `pyproject.toml`, `.env.example`, `src/config.py`
- **Code Block:**
```python
# src/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    PINECONE_API_KEY: str
    PINECONE_ENVIRONMENT: str
    PINECONE_INDEX_NAME: str
    NOTION_API_KEY: str
    SLACK_BOT_TOKEN: str
    LANGSMITH_API_KEY: str
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### Phase 2: Multi-Source Ingestion Pipeline
**Intent:** Develop robust loaders for PDF, Notion, and Slack, ensuring proper text chunking and metadata preservation.

- **Files:** `src/ingestion/loaders.py`, `src/ingestion/processor.py`
- **Code Block:**
```python
# src/ingestion/loaders.py
from langchain_community.document_loaders import PyPDFLoader, NotionDirectoryLoader, SlackDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_and_split(docs_path: str):
    # Example for PDF
    loader = PyPDFLoader(docs_path)
    documents = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        add_start_index=True
    )
    return text_splitter.split_documents(documents)
```

### Phase 3: Vector Store & Embedding Integration
**Intent:** Configure Pinecone vector database and OpenAI `text-embedding-3-small` for efficient document indexing.

- **Files:** `src/vector_store/client.py`
- **Code Block:**
```python
# src/vector_store/client.py
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from src.config import settings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

def get_vector_store():
    return PineconeVectorStore(
        index_name=settings.PINECONE_INDEX_NAME,
        embedding=embeddings,
        pinecone_api_key=settings.PINECONE_API_KEY
    )
```

### Phase 4: RAG Chain & Tracing
**Intent:** Implement the retrieval-augmented generation logic using LangChain and enable LangSmith for tracing.

- **Files:** `src/chain/rag_chain.py`
- **Code Block:**
```python
# src/chain/rag_chain.py
import os
from langchain_openai import ChatOpenAI
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

os.environ["LANGCHAIN_TRACING_V2"] = "true"

def create_rag_chain(vector_store):
    llm = ChatOpenAI(model="gpt-4-turbo-preview")
    retriever = vector_store.as_retriever(search_kwargs={"k": 5})
    
    system_prompt = (
        "You are an assistant for question-answering tasks. "
        "Use the following pieces of retrieved context to answer the question."
        "\n\n"
        "{context}"
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, question_answer_chain)
```

### Phase 5: Evaluation Framework
**Intent:** Integrate RAGAS to measure faithfulness, answer relevance, and context precision.

- **Files:** `src/eval/evaluate.py`
- **Code Block:**
```python
# src/eval/evaluate.py
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision
from datasets import Dataset

def run_evaluation(test_data):
    # Expects list of dicts with: question, contexts, answer, ground_truth
    dataset = Dataset.from_list(test_data)
    results = evaluate(
        dataset,
        metrics=[faithfulness, answer_relevancy, context_precision]
    )
    return results
```

## Verification
1. **Unit Tests:** Validate individual loaders and text splitting logic.
2. **Integration Tests:** Ensure documents are correctly indexed and retrieved from Pinecone.
3. **End-to-End Tests:** Verify the full RAG chain response quality against a golden dataset.
4. **Performance Benchmarking:** Measure latency of retrieval and generation phases.
5. **Observability Check:** Confirm LangSmith traces capture every step of the chain.

## Risks and Mitigations
- **Data Privacy:** Slack and Notion data might contain PII. *Mitigation:* Implement PII filtering/masking during ingestion.
- **Context Window Limits:** Large documents might exceed LLM context. *Mitigation:* Use optimized chunking and re-ranking (e.g., Cohere Rerank).
- **Hallucination:** RAG systems can still generate false info. *Mitigation:* Use RAGAS metrics to trigger alerts when faithfulness falls below 0.8.
- **API Costs:** High volume of embeddings and LLM calls. *Mitigation:* Implement caching for embeddings and frequent queries.
