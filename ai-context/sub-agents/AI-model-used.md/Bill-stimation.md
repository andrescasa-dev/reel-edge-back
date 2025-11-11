## 🔍 Escenario base

Tu sistema ejecutará:

- **1 vez al día** (o bajo demanda).
- Hará investigación en web para:

  - Encontrar casinos licenciados (por 4 estados).
  - Buscar promociones actualizadas.

- No usará scraping (solo APIs o IA con búsqueda integrada).
- La comparación de promociones es mínima (poca inferencia, bajo uso de tokens).
- Presupuesto sin definir → buscamos **mínimo costo operativo con buena precisión.**

---

## 💸 Comparativa simplificada

| API / Modelo                             | Costo base                                     | Cobro por             | Ideal para                           | Coste estimado por ejecución diaria (ligera)           | Observaciones                                                                                                       |
| ---------------------------------------- | ---------------------------------------------- | --------------------- | ------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **🟢 Perplexity API (Search + Sonar)**   | ~US$5 por cada 1 000 búsquedas                 | Solicitud (no tokens) | Investigación web (búsquedas reales) | **US$0.10/día ≈ US$3/mes** (20 búsquedas/día)          | La más barata si usas pocas búsquedas. Está optimizada para web research. Devuelve datos con fuentes. Sin scraping. |
| **🟣 Google Gemini 2.5 Flash (via API)** | US$0.30 input + US$2.50 output / millón tokens | Tokens                | Razonamiento ligero, outputs JSON    | **US$0.01–0.05/día ≈ US$1–2/mes** (bajo uso de tokens) | Muy barato por token, pero **no tiene buscador real**, deberías conectar una API de Google Search aparte.           |
| **🔵 GPT-4o (OpenAI)**                   | US$2.50 input + US$10 output / millón tokens   | Tokens                | Procesar texto, análisis             | **US$0.05–0.10/día ≈ US$2–3/mes**                      | Barato si consumes pocos tokens, pero **sin acceso directo a web** (necesitas browsing tool o plugin externo).      |

---

## 🧩 Conclusión directa

| Criterio                                                                       | Mejor opción            | Por qué                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Costo mensual total**                                                        | 🟣 **Gemini 2.5 Flash** | Más barato por token si tus prompts son pequeños y ya tienes URLs o data filtrada.                                                                                 |
| **Costo–beneficio en “research real” (buscar info actualizada en web)**        | 🟢 **Perplexity API**   | Su API incluye búsqueda real con grounding web — no necesitas scraper ni plugin externo. Si haces solo ~20–50 búsquedas al día, su coste mensual ronda **US$3–5**. |
| **Menor complejidad de integración (Node.js)**                                 | 🟢 **Perplexity API**   | Su “Search API” tiene endpoint REST directo, muy fácil de integrar.                                                                                                |
| **Mayor control y calidad del texto estructurado (JSON, razonamiento simple)** | 🔵 **GPT-4o**           | Mejores capacidades de formato, pero requiere datos previos (sin browsing).                                                                                        |

---

## ✅ Recomendación final (para tu caso real)

> **Opción ganadora: 🟢 Perplexity API (Search + Sonar)**

**Razones:**

1. Está optimizada para **real-time web research**, que es tu necesidad principal.
2. Es **económica para uso diario bajo demanda** (~US$3–5/mes).
3. No requiere scraping ni manejar proxies.
4. Devuelve resultados con **citas y estructura** (más fácil de comparar con tu base Reel Edge).
5. Se integra fácilmente en **Node.js con fetch/axios** (sin SDK complejo).
6. No pagas por tokens largos de razonamiento, solo por búsquedas concretas.

---

## 🧮 Estimación realista

Supón:

- 4 estados × 3 casinos promedio por estado × 2 consultas (licencia + promos) = 24 búsquedas/día.
- Perplexity cobra US$5 por 1 000 búsquedas = US$0.12/día ≈ **US$3.60/mes**.

> **Resultado:** obtienes datos actualizados todos los días de fuentes oficiales y confiables, sin pasarte de US$5 mensuales.
> Si en el futuro escalas a 10× más estados o casinos, seguirás por debajo de US$50/mes.
