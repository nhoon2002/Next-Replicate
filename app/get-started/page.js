"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
    </div>
  );
}

export default function GetStarted() {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("enhance");
  const promptInputRef = useRef(null);

  const AVAILABLE_MODELS = {
    enhance: "Stability AI SDXL (Best Overall)",
    openjourney: "OpenJourney v4 (Artistic Enhancement)",
    deepfloyd: "DeepFloyd IF (High Detail)",
    masactrl: "MasaCtrl (Best for Consistent Edits)",
    kling: "Kling v1.6 (Video Generation)",
  };

  useEffect(() => {
    promptInputRef.current?.focus();
  }, []);

  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedImage(file);
      setImageUrl(URL.createObjectURL(file));
      // Reset any previous results
      setPrediction(null);
    }
  };

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
    // Reset prediction when model changes
    setPrediction(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!uploadedImage) {
      setError("Please upload an image first");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const base64Image = await getBase64(uploadedImage);
      const userPrompt = e.target.prompt.value;

      // Prepare the request body based on the selected model
      const requestBody = {
        model: selectedModel,
        prompt: userPrompt,
      };

      // Handle model-specific parameters
      if (selectedModel === "masactrl") {
        requestBody.source_prompt = "a photo";
        requestBody.target_prompt = userPrompt || "a high quality photo";
        requestBody.image = base64Image;
      } else if (selectedModel === "kling") {
        requestBody.start_image = base64Image;
      } else {
        requestBody.image = base64Image;
      }

      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      let prediction = await response.json();
      if (response.status !== 201) {
        setError(prediction.detail);
        setIsProcessing(false);
        return;
      }
      setPrediction(prediction);

      while (
        prediction.status !== "succeeded" &&
        prediction.status !== "failed"
      ) {
        await sleep(250);
        const response = await fetch(`/api/predictions/${prediction.id}`);
        prediction = await response.json();
        if (response.status !== 200) {
          setError(prediction.detail);
          setIsProcessing(false);
          return;
        }
        console.log({ prediction });
        setPrediction(prediction);
      }

      if (prediction.status === "succeeded") {
        // Clear the original image when we have the result
        setImageUrl(null);
      }
      setIsProcessing(false);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-5">
      <h1 className="py-6 text-center font-bold text-2xl">
        Enhance images with AI
      </h1>

      <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload an image to enhance
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full"
            disabled={isProcessing}
          />
        </div>

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Enhancement Model
          </label>
          <select
            name="model"
            className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            disabled={isProcessing}
            value={selectedModel}
            onChange={handleModelChange}
          >
            {Object.entries(AVAILABLE_MODELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {imageUrl && !prediction?.output && (
          <div className="image-wrapper mt-4 mb-4">
            <Image
              src={imageUrl}
              alt="Uploaded image"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        )}

        <div className="flex w-full">
          <input
            type="text"
            className="flex-grow"
            name="prompt"
            placeholder="Enter instructions for enhancing the image"
            ref={promptInputRef}
            disabled={isProcessing}
          />
          <button
            className="button"
            type="submit"
            disabled={!uploadedImage || isProcessing}
          >
            {isProcessing ? "Processing..." : "Enhance!"}
          </button>
        </div>
      </form>

      {error && <div className="mt-4 text-red-500">{error}</div>}

      {isProcessing && (
        <div className="mt-8 text-center">
          <LoadingSpinner />
          <p className="mt-2 text-gray-600">Enhancing your image...</p>
        </div>
      )}

      {prediction?.output && (
        <div className="mt-5">
          <h2 className="text-lg font-medium mb-2">Result:</h2>
          <div className="image-wrapper">
            {selectedModel === "kling" ? (
              // Video output for Kling model
              <video
                controls
                loop
                autoPlay
                muted
                className="w-full h-full object-contain"
                src={prediction.output}
              />
            ) : (
              // Image output for other models
              <Image
                fill
                src={prediction.output[prediction.output.length - 1]}
                alt="Enhanced output"
                sizes="100vw"
                className="object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
