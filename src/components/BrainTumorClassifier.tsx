import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Brain, FileImage, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import brainMriSample from '@/assets/brain-mri-sample.jpg';

interface PredictionResult {
  class: string;
  confidence: number;
}

interface ClassificationResult {
  predictions: PredictionResult[];
  primaryPrediction: string;
  uploadedImage: string;
}

const GRADIO_API_URL = "https://affddb7ddcca425d64.gradio.live/";

const tumorTypes = [
  { name: 'No Tumor', color: 'success', icon: CheckCircle2 },
  { name: 'Glioma Tumor', color: 'warning', icon: AlertCircle },
  { name: 'Meningioma Tumor', color: 'destructive', icon: AlertCircle },
  { name: 'Pituitary Tumor', color: 'primary', icon: AlertCircle }
];

export const BrainTumorClassifier = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    try {
      // Convert file to base64 for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Start prediction process
      setIsLoading(true);
      setResult(null);

      toast({
        title: "Processing Image",
        description: "Connecting to AI model for analysis...",
      });

      // Call Gradio API using fetch
      const formData = new FormData();
      formData.append('data', JSON.stringify([file]));

      const response = await fetch(`${GRADIO_API_URL}api/predict/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const apiResult = await response.json();
      console.log('API Response:', apiResult);

      toast({
        title: "Analyzing...",
        description: "AI model is processing your MRI image",
      });

      // Parse the prediction results
      if (apiResult.data && Array.isArray(apiResult.data)) {
        const predictions = apiResult.data[0]; // Usually the first element contains the predictions
        
        // Map the predictions to our tumor types
        let mappedPredictions: PredictionResult[];
        
        if (Array.isArray(predictions)) {
          // If predictions is an array of confidence scores
          mappedPredictions = [
            { class: 'Glioma Tumor', confidence: (predictions[0] || 0) * 100 },
            { class: 'Meningioma Tumor', confidence: (predictions[1] || 0) * 100 },
            { class: 'No Tumor', confidence: (predictions[2] || 0) * 100 },
            { class: 'Pituitary Tumor', confidence: (predictions[3] || 0) * 100 }
          ];
        } else if (typeof predictions === 'object') {
          // If predictions is an object with named keys
          mappedPredictions = [
            { class: 'Glioma Tumor', confidence: (predictions['glioma_tumor'] || predictions['Glioma Tumor'] || 0) * 100 },
            { class: 'Meningioma Tumor', confidence: (predictions['meningioma_tumor'] || predictions['Meningioma Tumor'] || 0) * 100 },
            { class: 'No Tumor', confidence: (predictions['no_tumor'] || predictions['No Tumor'] || 0) * 100 },
            { class: 'Pituitary Tumor', confidence: (predictions['pituitary_tumor'] || predictions['Pituitary Tumor'] || 0) * 100 }
          ];
        } else {
          throw new Error('Unexpected prediction format');
        }

        // Sort by confidence
        mappedPredictions.sort((a, b) => b.confidence - a.confidence);

        setResult({
          predictions: mappedPredictions,
          primaryPrediction: mappedPredictions[0].class,
          uploadedImage: uploadedImage || ''
        });

        toast({
          title: "Analysis Complete",
          description: `Primary prediction: ${mappedPredictions[0].class} (${mappedPredictions[0].confidence.toFixed(1)}%)`,
        });
      } else {
        throw new Error('Unexpected API response format');
      }

    } catch (error) {
      console.error('Prediction error:', error);
      toast({
        title: "API Connection Failed",
        description: "Cannot connect to the AI model. Using demo mode instead.",
        variant: "default"
      });
      
      // Fallback to mock data for demonstration
      const mockPredictions: PredictionResult[] = [
        { class: 'No Tumor', confidence: 72.4 },
        { class: 'Glioma Tumor', confidence: 18.6 },
        { class: 'Pituitary Tumor', confidence: 6.8 },
        { class: 'Meningioma Tumor', confidence: 2.2 }
      ];

      setResult({
        predictions: mockPredictions,
        primaryPrediction: mockPredictions[0].class,
        uploadedImage: uploadedImage || ''
      });

      toast({
        title: "Demo Results",
        description: "Showing sample predictions (API unavailable)",
        variant: "default"
      });

    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setUploadedImage(null);
    setResult(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-surface p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 medical-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-gradient-medical shadow-medical">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Brain Tumor Classifier
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Advanced AI-powered brain tumor detection and classification system. 
            Upload an MRI image for accurate tumor type identification.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="p-6 bg-gradient-card shadow-card medical-scale-in">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Upload MRI Image</h2>
              </div>

              {!uploadedImage ? (
                <div
                  className={`upload-zone border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                    dragActive
                      ? 'border-primary bg-primary/5 shadow-medical'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Drop your MRI image here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse files
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports JPEG, PNG • Max 10MB
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={uploadedImage}
                      alt="Uploaded MRI"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={resetAnalysis}
                    className="w-full"
                  >
                    Upload Different Image
                  </Button>
                </div>
              )}

              {/* Sample Image */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Try with sample image:</p>
                <div 
                  className="relative rounded-lg overflow-hidden cursor-pointer upload-zone bg-muted"
                  onClick={async () => {
                    try {
                      // Convert sample image to File object for API call
                      const response = await fetch(brainMriSample);
                      const blob = await response.blob();
                      const file = new File([blob], 'sample-mri.jpg', { type: 'image/jpeg' });
                      
                      setUploadedImage(brainMriSample);
                      handleFileUpload(file);
                      
                      toast({
                        title: "Sample Image Loaded",
                        description: "Analyzing sample MRI image...",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to load sample image",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <img
                    src={brainMriSample}
                    alt="Sample brain MRI"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white font-medium">Click to use sample</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Results Section */}
          <Card className="p-6 bg-gradient-card shadow-card medical-scale-in">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Analysis Results</h2>
              </div>

              {!uploadedImage && !isLoading && !result && (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Upload an MRI image to see analysis results</p>
                </div>
              )}

              {isLoading && (
                <div className="text-center py-12">
                  <div className="medical-pulse mb-4">
                    <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
                  </div>
                  <p className="text-lg font-medium">Analyzing brain MRI...</p>
                  <p className="text-sm text-muted-foreground">
                    Processing image with AI model
                  </p>
                </div>
              )}

              {result && (
                <div className="space-y-6 medical-fade-in">
                  {/* Primary Prediction */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary-glow/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/20">
                        {React.createElement(
                          tumorTypes.find(type => type.name === result.primaryPrediction)?.icon || AlertCircle,
                          { className: "h-5 w-5 text-primary" }
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Primary Prediction</p>
                        <p className="text-xl font-bold text-primary">{result.primaryPrediction}</p>
                        <p className="text-sm">
                          Confidence: {result.predictions[0].confidence.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* All Predictions */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Detailed Analysis</h3>
                    {result.predictions.map((prediction, index) => {
                      const tumorType = tumorTypes.find(type => type.name === prediction.class);
                      return (
                        <div key={prediction.class} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {React.createElement(tumorType?.icon || AlertCircle, {
                                className: "h-4 w-4"
                              })}
                              <span className="font-medium">{prediction.class}</span>
                            </div>
                            <span className="text-sm font-medium">
                              {prediction.confidence.toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={prediction.confidence}
                            variant="confidence"
                            className="h-2"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Disclaimer */}
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning mb-1">Medical Disclaimer</p>
                        <p className="text-muted-foreground">
                          This AI analysis is for research purposes only and should not replace 
                          professional medical diagnosis. Always consult qualified healthcare 
                          professionals for medical decisions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};