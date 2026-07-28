def lambda_handler(event, context):
    return {
        "isBase64Encoded": False,
        "statusCode": 200,
        "headers": {"Content-Type": "text/plain"},
        "body": "Hello from Orders v2 (Lambda)",
    }
