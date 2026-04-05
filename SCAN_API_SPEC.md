# Scanner AI API Specification

To implement the AI scanning logic, your API should follow this specification.

## Endpoint
`POST [YOUR_API_URL]/scan`

## Request
The `CameraScanner` component will send a base64 encoded string of the captured frame.

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJR...",
  "timestamp": 1675789426,
  "context": "casio_fx_screen"
}
```

## Response
The API should return an object containing the result string to be displayed on the LCD.

```json
{
  "status": "success",
  "result": "X = 42",
  "data": {
    "calculation": "5 * 8 + 2",
    "steps": ["5 * 8 = 40", "40 + 2 = 42"]
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Could not identify formula."
}
```

## Integration Instructions
1. Replace the `mockAiCall` in `app/(tabs)/index.tsx` with a real `fetch` request.
2. The `result` field will be directly set to the `displayText` on the calculator screen.
