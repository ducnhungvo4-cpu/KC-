Agnes Video V2.0
# Agnes-Video-V2.0
Agnes-Video-V2.0 es un modelo de generación de video cinematográfico de nueva generación diseñado para flujos de trabajo de alta calidad de texto a video (Text-to-Video), imagen a video (Image-to-Video), generación de video a partir de múltiples imágenes y animación mediante fotogramas clave (Keyframe Animation).
Genera videos de alta fidelidad con una sólida consistencia de movimiento, coherencia de escena y realismo visual, permitiendo a los usuarios crear contenido de video listo para producción a partir de indicaciones de texto, imágenes de referencia o múltiples fotogramas clave.
Agnes-Video-V2.0 es ideal para narración de historias, videos de marketing, demostraciones de productos, contenido para redes sociales, producción visual inmersiva y flujos de trabajo creativos impulsados por IA.
## Resumen del Modelo
Agnes-Video-V2.0 está optimizado para la generación de video de alta calidad y un control creativo flexible.
Admite las siguientes capacidades:
## Escenarios de Aplicación
Agnes-Video-V2.0 es adecuado para:
## Información de la API
### Endpoint
## Flujo de Trabajo
Agnes-Video-V2.0 utiliza un flujo de trabajo asíncrono basado en tareas.
### Paso 1: Crear una Tarea de Video
Envía una solicitud POST a:
```
https://apihub.agnes-ai.com/v1/videos
```
La API devolverá un ID de tarea.
### Paso 2: Recuperar el Resultado del Video
Utiliza el ID de tarea para enviar una solicitud GET a:
```
https://apihub.agnes-ai.com/v1/videos/{task_id}
```
El resultado incluirá el estado de la tarea, el progreso y la URL final del video cuando la generación haya finalizado.
## Parámetros de Solicitud
### Crear una Tarea de Video
## Ejemplos de Uso
### 1. Solicitud Text-to-Video
Utiliza esta solicitud para generar un video directamente a partir de un prompt de texto.
```
curl -X POST https://apihub.agnes-ai.com/v1/videos \
-H "Authorization: Bearer YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "agnes-video-v2.0",
    "prompt": "A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion",
    "height": 768,
    "width": 1152,
    "num_frames": 121,
    "frame_rate": 24
  }'
```
### 2. Solicitud Image-to-Video
Utiliza esta solicitud para animar una sola imagen.
```
curl -X POST https://apihub.agnes-ai.com/v1/videos \
-H "Authorization: Bearer YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "agnes-video-v2.0",
    "prompt": "The woman slowly turns around and looks back at the camera, natural facial expression, cinematic camera movement",
    "image": "https://example.com/image.png",
    "num_frames": 121,
    "frame_rate": 24
  }'
```
### 3. Solicitud Multi-Image Video
Utiliza esta solicitud para generar un video guiado por múltiples imágenes de entrada.
```
curl -X POST https://apihub.agnes-ai.com/v1/videos \
-H "Authorization: Bearer YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "agnes-video-v2.0",
    "prompt": "Create a smooth transformation scene between the two reference images, cinematic lighting, consistent character identity, natural motion",
    "extra_body": {
      "image": [
        "https://example.com/image1.png",
        "https://example.com/image2.png"
      ]
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```
### 4. Solicitud de Animación por Keyframes
Utiliza esta solicitud para generar interpolaciones suaves entre keyframes.
```
curl -X POST https://apihub.agnes-ai.com/v1/videos \
-H "Authorization: Bearer YOUR_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "model": "agnes-video-v2.0",
    "prompt": "Generate a smooth cinematic transition between the keyframes, maintaining visual consistency and natural camera movement",
    "extra_body": {
      "image": [
        "https://example.com/keyframe1.png",
        "https://example.com/keyframe2.png"
      ],
      "mode": "keyframes"
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```
### 5. Solicitud para Obtener el Resultado
Utiliza esta solicitud para consultar el estado de la tarea y el resultado final.
```
curl -X GET https://apihub.agnes-ai.com/v1/videos/{task_id} \
-H "Authorization: Bearer YOUR_API_KEY"
```
## Formato de Respuesta
### Respuesta al Crear una Tarea
```
{
  "id":"task_123456",
  "object":"video",
  "model":"agnes-video-v2.0",
  "status":"queued",
  "progress":0,
  "created_at":1774344160
}
```
### Respuesta al Obtener el Resultado
```
{
  "id":"task_123456",
  "object":"video",
  "model":"agnes-video-v2.0",
  "status":"completed",
  "progress":100,
  "created_at":1774344160,
  "completed_at":1774344311,
  "video_url":"https://storage.googleapis.com/...",
  "size":"1152x768",
  "seconds":"5.0",
  "usage": {
    "duration_seconds":151
  }
}
```
## Descripción de Campos
## Descripción del Campo Usage
## Estados de la Tarea
## Códigos de Error
## Precios
## Funciones y Compatibilidad
Agnes-Video-V2.0 admite:
- Generación de video a partir de texto
- Generación de video a partir de imágenes
- Generación de video guiada por múltiples imágenes
- Animación por keyframes e interpolación suave
- Control de movimiento y escenas mediante prompts
- Salida visual de calidad cinematográfica
- Generación de video asíncrona basada en tareas
- Recuperación de resultados mediante polling
- Reproducibilidad basada en seed
- Diseño de API estilo OpenAI con extensiones basadas en tareas
## Mejores Prácticas
### Prompt para Text-to-Video
Para la generación de video a partir de texto, describe el sujeto, la acción, el entorno, la iluminación, el movimiento de cámara y el estilo.
Estructura recomendada:
```
[Sujeto] + [Acción] + [Escena] + [Movimiento de Cámara] + [Iluminación] + [Estilo]
```
Ejemplo:
```
Un joven astronauta caminando por un planeta desértico rojo, polvo volando con el viento, toma cinematográfica de seguimiento lenta, iluminación dramática al atardecer, estilo de ciencia ficción realista
```
### Prompt para Image-to-Video
Describe qué debe moverse mientras mantienes estable al sujeto principal.
Ejemplo:
```
Animar al personaje con una ligera respiración, cabello moviéndose suavemente con el viento y luces de fondo parpadeando suavemente, manteniendo el rostro y la vestimenta consistentes
```
### Prompt para Multi-Image
Describe cómo deben relacionarse las imágenes de entrada.
Ejemplo:
```
Utiliza la primera imagen como escena inicial y la segunda como escena objetivo. Crea una transformación suave con iluminación consistente, movimiento natural y ritmo cinematográfico
```
### Prompt para Keyframes
Describe claramente la transición entre los fotogramas clave.
Ejemplo:
```
Crea una transición suave desde el primer keyframe al segundo, manteniendo la identidad del personaje, un ángulo de cámara consistente y movimiento natural entre escenas
```
## Recomendaciones de Parámetros
## Notas
- Utiliza agnes-video-v2.0 como nombre del modelo.
- La generación de video es asíncrona. Debes crear una tarea primero y luego recuperar el resultado mediante el ID de tarea.
- video_url solo estará disponible cuando el estado de la tarea sea completed.
- num_frames debe ser menor o igual a 441.
- num_frames debe cumplir el formato 8n + 1, como 81, 121, 161, 241 o 441.
- Para Text-to-Video, solo se requieren model y prompt.
- Para Image-to-Video, proporciona una URL de imagen mediante image.
- Para Multi-Image Video, proporciona múltiples URLs en extra_body.image.
- Para Keyframe Animation, establece extra_body.mode como keyframes.
- Los precios de Agnes-Video-V2.0 se anunciarán próximamente.