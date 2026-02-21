curl -X POST http://localhost:3000/documents \
  -F "file=@apps/api/package.json" \
  -H "Content-Type: multipart/form-data"
