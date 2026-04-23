FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy the source code
COPY . .

# Initialize Go modules and get dependencies
RUN go mod init welcome-board-backend && go get github.com/gin-gonic/gin@v1.9.1 && go get github.com/gin-contrib/cors@v1.4.0 && go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/server

# Use a minimal alpine image for the final stage
FROM alpine:latest  

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

# Expose port 8080
EXPOSE 8080

# Command to run the executable
CMD ["./main"]
