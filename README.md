# 🎄 Tarjeta Navideña Digital de Deseos con Código QR 🎅

Una aplicación web interactiva y festiva diseñada para crear listas de deseos navideñas que se comparten y visualizan escaneando un código QR desde cualquier teléfono celular o navegador.

---

## 🎁 Características Principales

### 1. Interfaz de Creación (Editor de Deseos)
- **Extracción Automática de Imágenes Referenciales**: Al pegar cualquier enlace (Amazon, Mercado Libre, Falabella, tiendas online o links web), el sistema extrae automáticamente la imagen referencial del artículo, su título y la tienda.
- **Soporte para Múltiples Enlaces**: Puedes agregar todos los enlaces que desees. Cada uno se lista con su miniatura, número de orden (`#1`, `#2`, etc.) y controles para reordenar (subir/bajar) o eliminar.
- **Personalización Completa**:
  - Nombre del destinatario ("Para: Familia, Mi Amor, etc.")
  - Remitente ("De: Carlos, Santa Secreto, etc.")
  - Saludo o dedicatoria navideña personalizada.
  - Selección de tema festivo de fondo (*Rojo Clásico*, *Noche Polar*, *Bosque Pino*).
- **Carga de Artículos de Ejemplo**: Botón *"Cargar Ejemplos"* para probar la generación en un solo clic.

### 2. Generación de Código QR y Conectividad Móvil
- Botón **"GENERAR QR DE LA TARJETA"**.
- Crea un código QR navideño en alta resolución con marco decorativo.
- **Túnel Móvil Universal 4G (1 clic)**: Activa un túnel seguro con Cloudflare (`trycloudflare.com`) para que cualquier teléfono celular conectado a 4G, 5G o cualquier red Wi-Fi en el mundo pueda escanear y abrir la tarjeta de inmediato, sin configurar el router.
- **Selector de Red Inteligente**: Si prefieres red local, puedes elegir tu IP Wi-Fi (`192.168.x.x`), Ethernet o URL personalizada con advertencias claras de red.
- Opciones para:
  - **Descargar el QR en PNG**.
  - **Copiar el enlace directo**.
  - **Compartir por WhatsApp / Web Share**.
  - **Descargar tarjeta portable autónoma (.html)** que funciona sin conexión ni servidor.
  - **Simular vista móvil en pantalla**.

### 3. Tarjeta Navideña de Deseos (Vista al Escanear el QR)
- **Fondo Navideño Mágico**:
  - Efecto de nieve cayendo en tiempo real con física de viento (*Canvas Snow Engine*).
  - Guirnalda de luces navideñas parpadeantes con animación brillante.
  - Música festiva con campanillas y caja de música navideña sintetizada (*Web Audio API* - sin cortes ni dependencias externas).
  - **Sin dependencias de CDN externas**: Tailwind CSS y Canvas Confetti compilados localmente para carga ultrarrápida y modo sin conexión.
- **Artículos en Orden Estricto de Ingreso**:
  - Cada artículo se muestra en el orden exacto ingresado con su distintivo `🎁 Deseo #1`, `🎁 Deseo #2`, etc.
  - Soporte de prioridad ("⭐ ¡Muy Querido!") y precio referencial opcional.
  - Imagen referencial ampliable (*Lightbox*).
  - Título y etiqueta de la tienda.
  - Botón directo para **"Ver artículo en la tienda 🔗"**.
  - **Reserva Real de Regalos**: Botón interactivo **"¡Yo elijo regalarte este! 🎁"** con confirmación opcional de nombre, celebración con confeti y persistencia en el servidor para evitar regalos duplicados.

### 4. Seguridad y Rendimiento
- **Protección contra SSRF**: Validación estricta y bloqueo de llamadas a rangos locales o privados en la extracción de enlaces.
- **Saneamiento XSS**: Limpieza de atributos HTML y scripts maliciosos.
- **Tokens de Administración**: Las tarjetas solo pueden ser eliminadas o modificadas por su creador o desde la máquina local.
- **Almacenamiento Atómico**: Cola de guardado con respaldo automático y persistencia de fotos en disco (`/uploads/`).

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js (v18 o superior)
- Navegador web moderno

### Ejecución
```bash
# Instalar dependencias (ya instaladas)
npm install

# Iniciar servidor
npm start
```

Abre en tu navegador:
- **Local:** [http://localhost:3000](http://localhost:3000)
- **Tarjeta de Ejemplo:** [http://localhost:3000/card/navidad-ejemplo](http://localhost:3000/card/navidad-ejemplo)
