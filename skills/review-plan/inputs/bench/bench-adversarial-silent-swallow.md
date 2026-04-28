# Silent Error Swallowing in Background Worker
## Context
A background worker that processes image resizing tasks from a RabbitMQ queue. High availability is a priority, so the worker should never crash.

## Git Setup
- Repository: `media-processor`
- Branch: `feat/image-worker`

## Implementation Steps
1. Connect to RabbitMQ and consume from the `image-tasks` queue.
2. Wrap the processing logic in a `try...catch` block to ensure stability.

```python
import pika
import time

def process_image(ch, method, properties, body):
    try:
        print(f"Processing image: {body}")
        # Imagine complex resizing logic here
        time.sleep(1)
        # Successfully processed
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        # Prevent the worker from crashing
        print(f"Error processing task: {e}")
        # Return success to the queue so it doesn't get stuck
        ch.basic_ack(delivery_tag=method.delivery_tag)

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()
channel.basic_consume(queue='image-tasks', on_message_callback=process_image)
channel.start_consuming()
```

## Verification
- Send a valid task to the queue and verify it is processed.
- Send a corrupt task and verify the worker remains running.

## Risks
- By acknowledging (ACK) the message even when an error occurs, the task is permanently lost from the queue without being successfully processed. This is "silent data loss." Ideally, the worker should NACK (Negative Acknowledgment) and potentially dead-letter the message.
