curl -X POST http://localhost:3000/documents \
  -F "file=@package.json" \
  -H "Content-Type: multipart/form-data"
