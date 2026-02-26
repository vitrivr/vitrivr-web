# VITRIVR-WEB

## Description

The vitrivr frontend, **vitrivr-web**, was developed as a React application, as this framework enables straightforward
modularization of components and facilitates deployment.

The frontend architecture follows a modular, component-based approach, making it easily adaptable and extendable to
accommodate potential changes in the backend. Queries are formulated through different components that act as building
blocks. These components can either be used individually or combined to form temporal queries.

Each block provides a selection for the modality type (**CLIP**, **emotions**, **OCR**, **ASR**).

* **CLIP** enables users to submit either textual queries or perform image-to-image searches to retrieve the *k* nearest
  neighbors.
* In the context of **emotions**, a textual query (CLIP) can be integrated with a filter to restrict results to a
  particular emotion.
* Emotion detection is a multimodal process that integrates facial expression analysis, automatic speech emotion
  recognition, and OCR-based text emotion analysis into a unified score.
* Furthermore, the system is equipped with the capability to process both OCR and ASR through textual queries.

The frontend further provides functionality to display and filter search results for faster access. The available
filters encompass options such as media type, including videos, images, and 3D models.

The ensuing results are presented in descending order of relevance. With regard to the video results, playback is
initiated at the frame that most closely corresponds to the query.

The filtering functionality is of particular importance in the context of video retrieval competitions, as it enables
the refinement of the result set.

Moreover, the frontend incorporates the [DRES](https://github.com/dres-dev/DRES) framework, which was developed to
assess the performance of multimedia retrieval systems.

---

## Project Structure

```
frontend-vitrivr/
├── vitrivr-web/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── dres/
│   │   ├── lib/
│   │   ├── state/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── vitrivr/
│   │   ├── App.tsx
│   │   └── main.tsx
```

---

## Setup

1. **Navigate to the frontend directory**

```bash
cd frontend-vitrivr
```

2. **Install all dependencies**

```bash
npm install
```

3. **Build the application**

```bash
npm run build
```

4. **Run the application in development mode**

```bash
npm run dev
```

---
