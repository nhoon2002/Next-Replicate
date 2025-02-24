import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Prevent Next.js / Vercel from caching responses
// See https://github.com/replicate/replicate-javascript/issues/136#issuecomment-1728053102
replicate.fetch = (url, options) => {
  return fetch(url, { ...options, cache: "no-store" });
};

// Model configurations
const MODELS = {
  // Stability AI's SDXL (current default)
  "enhance": {
    version: "8beff3369e81422112d93b89ca01426147de542cd4684c244b673b105188fe5f",
    defaultParams: {
      image_strength: 0.35,
      guidance_scale: 7.5,
      num_inference_steps: 25,
      negative_prompt: "blur, pixelated, low quality, distorted",
    }
  },
  // OpenJourney v4
  "openjourney": {
    version: "9ca13f02927c5ef346f29e6917114de0d5a2c4b12c14ce674b73ed9609bd0f4d",
    defaultParams: {
      prompt_strength: 0.8,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      negative_prompt: "blur, pixelated, low quality, distorted"
    }
  },
  // DeepFloyd IF
  "deepfloyd": {
    version: "2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2",
    defaultParams: {
      num_inference_steps: 50,
      guidance_scale: 7.5,
      negative_prompt: "low quality, bad quality, blurry"
    }
  },
  // MasaCtrl (Stable Diffusion v1.4)
  "masactrl": {
    version: "4e86d80ab64a8395e7fd327d34fe85d240a3d9e8706b7144864ba981eba3dfa6",
    defaultParams: {
      source_prompt: "a photo",  // Will be overridden by user prompt
      target_prompt: "a photo",  // Will be overridden by user prompt
      guidance_scale: 7.5,
      num_inference_steps: 30,
      seed: -1  // Random seed
    }
  },
  // Kling v1.6 (Video Generation)
  "kling": {
    version: "kwaivgi/kling-v1.6-standard",
    defaultParams: {
      prompt: "",  // Will be overridden by user input
      duration: 5,
      cfg_scale: 0.5,
      start_image: "a photo",
      negative_prompt: "low quality, bad quality, blurry"
    }
  }
};

// In production and preview deployments (on Vercel), the VERCEL_URL environment variable is set.
// In development (on your local machine), the NGROK_HOST environment variable is set.
const WEBHOOK_HOST = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NGROK_HOST;

export async function POST(request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      'The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it.'
    );
  }

  const {
    prompt,
    image,
    start_image,
    model = "enhance",
    source_prompt,
    target_prompt,
  } = await request.json();

  // Check for required image input
  if (!image && !start_image) {
    return NextResponse.json({ detail: "Image is required" }, { status: 400 });
  }

  if (!MODELS[model]) {
    return NextResponse.json(
      { detail: "Invalid model specified" },
      { status: 400 }
    );
  }

  const modelConfig = MODELS[model];
  
  const options = {
    version: modelConfig.version,
    input: {
      ...modelConfig.defaultParams,
    },
  };

  // Handle model-specific parameters
  if (model === "masactrl") {
    options.input.image = image;
    options.input.source_prompt = source_prompt || "a photo";
    options.input.target_prompt =
      target_prompt || prompt || "a high quality photo";
  } else if (model === "kling") {
    options.input.start_image = start_image;
    options.input.prompt = prompt || "Generate a video from this image";
  } else {
    options.input.image = image;
    options.input.prompt =
      prompt || "Enhance this image with better quality and details";
  }

  if (WEBHOOK_HOST) {
    options.webhook = `${WEBHOOK_HOST}/api/webhooks`;
    options.webhook_events_filter = ["start", "completed"];
  }

  try {
    const prediction = await replicate.predictions.create(options);

    if (prediction?.error) {
      return NextResponse.json({ detail: prediction.error }, { status: 500 });
    }

    return NextResponse.json(prediction, { status: 201 });
  } catch (error) {
    console.error("Error creating prediction:", error);
    return NextResponse.json(
      { detail: "Error processing your request" },
      { status: 500 }
    );
  }
}