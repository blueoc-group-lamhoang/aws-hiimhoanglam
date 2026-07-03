# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Create a non-privileged user and group to run the app
RUN groupadd -g 10001 appgroup && \
    useradd -r -u 10001 -g appgroup appuser

# Copy the requirements file first to leverage Docker layer caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Change ownership of /app to appuser to allow SQLite and ML models creation/write access
RUN chown -R appuser:appgroup /app

# Expose the port the app runs on
EXPOSE 8036

# Switch to the non-privileged user
USER appuser

# Run the application
# Binding to 0.0.0.0 is necessary for container traffic routing
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8036"]
