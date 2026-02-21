curl -X POST http://localhost:3000/documents/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "What are the dependencies in the api package.json?" }
    ]
  }' --no-buffer
