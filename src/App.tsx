import React, { useState, useEffect } from 'react';
import { Upload, User, Box, FileText, Camera, Play, Wand2, Loader2, Volume2, Sparkles, Video, X, Scissors, Plus, Trash2, Save, ChevronRight, ChevronLeft } from 'lucide-react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const getAI = (usePaidKey = false) => {
  const apiKey = usePaidKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
  if (usePaidKey && !apiKey) {
    throw new Error("Vertex AI Key Required");
  }
  return new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const createWavUrl = (base64Data: string) => {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const float32Data = new Float32Array(bytes.length / 2);
  const dataView = new DataView(bytes.buffer);
  for (let i = 0; i < float32Data.length; i++) {
    float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }
  
  const buffer = new ArrayBuffer(44 + float32Data.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + float32Data.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 24000 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, float32Data.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < float32Data.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  const blob = new Blob([view], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

const playPcm = async (base64Data: string) => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const float32Data = new Float32Array(bytes.length / 2);
    const dataView = new DataView(bytes.buffer);
    for (let i = 0; i < float32Data.length; i++) {
      float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }
    
    const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  } catch (err) {
    console.error("Failed to play audio", err);
  }
};

const Button = ({ children, onClick, disabled, loading, variant = 'primary', className = '' }: any) => {
  const baseStyle = "relative font-mono text-[11px] uppercase tracking-widest font-bold py-3 px-4 rounded-sm transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden";
  const variants = {
    primary: "bg-[#cfff04] text-black hover:bg-[#e4ff4d] disabled:bg-[#222] disabled:text-[#555]",
    secondary: "bg-transparent border border-[#cfff04] text-[#cfff04] hover:bg-[#cfff04]/10 disabled:border-[#222] disabled:text-[#555]"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading} 
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
};

const Card = ({ title, icon: Icon, action, children, className = '' }: any) => (
  <div className={`bg-[#111] border border-[#222] rounded-xl overflow-hidden flex flex-col shadow-xl ${className}`}>
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#222] bg-[#0a0a0a]">
      <div className="flex items-center gap-2 text-[#cfff04] font-mono text-[10px] tracking-widest uppercase">
        {Icon && <Icon size={14} />}
        <span>{title}</span>
      </div>
      {action && <div>{action}</div>}
    </div>
    <div className="p-4 flex-1 flex flex-col gap-4">
      {children}
    </div>
  </div>
);

const ImageUploadBox = ({ image, onUpload, label }: any) => (
  <div className="relative group w-full aspect-[4/5] bg-[#050505] border border-dashed border-[#333] rounded-xl overflow-hidden flex flex-col items-center justify-center hover:border-[#cfff04] transition-colors cursor-pointer">
    <input 
      type="file" 
      accept="image/*" 
      onChange={onUpload} 
      className="absolute inset-0 opacity-0 cursor-pointer z-10"
    />
    {image ? (
      <>
        <img src={image.url} alt={label} className="w-full h-full object-cover" />
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
          <span className="bg-black/60 backdrop-blur-sm text-[#cfff04] font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-[#cfff04]/30">
            {label}
          </span>
          <div className="w-2 h-2 rounded-full bg-[#cfff04] shadow-[0_0_8px_#cfff04]" />
        </div>
      </>
    ) : (
      <div className="flex flex-col items-center gap-3 text-[#555] group-hover:text-[#cfff04] transition-colors">
        <Upload size={24} />
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
    )}
  </div>
);

const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada'];
const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export default function App() {
  const [characterImg, setCharacterImg] = useState<{url: string, file: File} | null>(null);
  const [productImg, setProductImg] = useState<{url: string, file: File} | null>(null);
  
  const [productTags, setProductTags] = useState<string[]>([]);
  const [productDetails, setProductDetails] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [script, setScript] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [audioData, setAudioData] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [language, setLanguage] = useState('English');
  const [voice, setVoice] = useState('Kore');
  const [imageStyle, setImageStyle] = useState<'studio' | 'ultra-realistic' | 'iphone' | 'short' | 'normal'>('studio');
  const [durationSeconds, setDurationSeconds] = useState<'4' | '6' | '8'>('6');
  
  const [renderMode, setRenderMode] = useState<'image' | 'video'>('image');
  const [generatedImg, setGeneratedImg] = useState('');
  const [generatedVideo, setGeneratedVideo] = useState('');
  const [timeline, setTimeline] = useState<{id: string, url: string, start: number, end: number, duration: number}[]>([]);
  const [isProcessingTimeline, setIsProcessingTimeline] = useState(false);
  const [gallery, setGallery] = useState<{id: string, type: 'image' | 'video', url: string}[]>([]);
  const [scriptLibrary, setScriptLibrary] = useState<{id: string, title: string, script: string, videoPrompt: string, date: string}[]>([]);

  const ffmpegRef = React.useRef(new FFmpeg());

  useEffect(() => {
    const saved = localStorage.getItem('ugc_script_library');
    if (saved) {
      try {
        setScriptLibrary(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load script library", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ugc_script_library', JSON.stringify(scriptLibrary));
  }, [scriptLibrary]);

  const saveToLibrary = () => {
    if (!script) return;
    const newEntry = {
      id: Date.now().toString(),
      title: script.split('\n')[0].substring(0, 30) + '...',
      script,
      videoPrompt,
      date: new Date().toLocaleString()
    };
    setScriptLibrary([newEntry, ...scriptLibrary]);
  };

  const loadFromLibrary = (entry: any) => {
    setScript(entry.script);
    setVideoPrompt(entry.videoPrompt);
  };

  const deleteFromLibrary = (id: string) => {
    setScriptLibrary(scriptLibrary.filter(s => s.id !== id));
  };

  const addToTimeline = (item: any) => {
    if (item.type !== 'video') return;
    
    // Get duration (mocking for now, in real app we'd get it from metadata)
    const duration = 6; // Default to 6s since that's our default render
    
    const newEntry = {
      id: Date.now().toString(),
      url: item.url,
      start: 0,
      end: duration,
      duration: duration
    };
    setTimeline([...timeline, newEntry]);
  };

  const removeFromTimeline = (id: string) => {
    setTimeline(timeline.filter(t => t.id !== id));
  };

  const updateTimelineItem = (id: string, updates: any) => {
    setTimeline(timeline.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const moveTimelineItem = (index: number, direction: 'left' | 'right') => {
    const newTimeline = [...timeline];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= timeline.length) return;
    
    [newTimeline[index], newTimeline[targetIndex]] = [newTimeline[targetIndex], newTimeline[index]];
    setTimeline(newTimeline);
  };

  const processTimeline = async () => {
    if (timeline.length === 0) return;
    setIsProcessingTimeline(true);
    try {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.loaded) {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      const inputFiles = [];
      for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        const inputName = `input${i}.mp4`;
        const outputName = `output${i}.mp4`;
        await ffmpeg.writeFile(inputName, await fetchFile(item.url));
        
        // Trim command
        await ffmpeg.exec([
          '-ss', item.start.toString(), 
          '-to', item.end.toString(), 
          '-i', inputName, 
          '-c', 'copy', 
          outputName
        ]);
        inputFiles.push(outputName);
      }

      // Merge command
      const listContent = inputFiles.map(f => `file ${f}`).join('\n');
      await ffmpeg.writeFile('list.txt', listContent);
      
      await ffmpeg.exec([
        '-f', 'concat', 
        '-safe', '0', 
        '-i', 'list.txt', 
        '-c', 'copy', 
        'final.mp4'
      ]);
      
      const data = await ffmpeg.readFile('final.mp4');
      const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: 'video/mp4' }));
      
      setGeneratedVideo(url);
      setGallery(prev => [{ id: Date.now().toString(), type: 'video', url }, ...prev]);
      setRenderMode('video');
    } catch (e) {
      console.error("Timeline processing failed", e);
      alert("Video processing failed. This might be due to browser security restrictions or file format issues.");
    }
    setIsProcessingTimeline(false);
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgressMsg, setVideoProgressMsg] = useState('');
  const [videoError, setVideoError] = useState('');
  
  const [hasPaidKey, setHasPaidKey] = useState(!!process.env.API_KEY);

  useEffect(() => {
    const checkKey = async () => {
      if (process.env.API_KEY) {
        setHasPaidKey(true);
        return;
      }
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasPaidKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      // Assume success as per guidelines to mitigate race conditions
      setHasPaidKey(true);
      setVideoError('');
    }
  };

  const handleResetKey = async () => {
    setHasPaidKey(false);
    setVideoError('');
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setHasPaidKey(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'character' | 'product') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'character') setCharacterImg({ url, file });
    else setProductImg({ url, file });
  };

  const analyzeProduct = async () => {
    if (!productImg) return;
    setIsAnalyzing(true);
    try {
      const ai = getAI();
      const imagePart = await fileToGenerativePart(productImg.file);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          imagePart,
          { text: 'Analyze this product for a UGC ad.' }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "4-6 short descriptive keywords (e.g., 'Lipstick', 'Matte Finish', 'Gold Casing')"
              },
              description: {
                type: Type.STRING,
                description: "A punchy 2-sentence description of the product's visual appeal and vibe."
              }
            },
            required: ["tags", "description"]
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      if (data.tags) setProductTags(data.tags);
      if (data.description) setProductDetails(data.description);
    } catch (e) {
      console.error(e);
    }
    setIsAnalyzing(false);
  };

  const generateScript = async () => {
    setIsGeneratingScript(true);
    setScript('');
    setVideoPrompt('');
    try {
      const ai = getAI();
      const prompt = `You are an expert TikTok/Instagram Reels UGC creator and viral content strategist. 
      Based on this product: ${productDetails}, create a high-energy, viral-style UGC script AND a detailed video generation prompt.
      ${userPrompt ? `Additional User Instructions: ${userPrompt}` : ''}
      The spoken script MUST be written in ${language}.
      
      VIRAL STRUCTURE (MANDATORY):
      1. HOOK (0-2s): A high-energy, attention-grabbing opening that stops the scroll.
      2. MIDDLE/PAYOFF (2-6s): The core value, demonstration, or "wow" moment of the product.
      3. CTA (6-8s): A clear, punchy call to action (e.g., "Link in bio", "Shop now").
      
      SCENE ORGANIZATION: Organize the script into clear, numbered scenes (e.g., Scene 1: Hook, Scene 2: Payoff, Scene 3: CTA).
      The script MUST include visual cues enclosed in square brackets at the start of each scene (e.g., [Scene 1: 2s - Creator points to camera with high energy], [Scene 2: 4s - Close-up on product in action]) that describe actions, scene changes, and approximate timing within the total video duration (${durationSeconds}s).
      
      CRITICAL FOR PRECISION LIP-SYNC: The video prompt MUST explicitly and meticulously describe the creator's mouth movements, jaw synchronization, and facial expressions to match the spoken words (or lyrics) in the script. 
      Instructions for the video prompt:
      1. Describe the precise articulation of lips and jaw as they form the specific sounds of the script.
      2. Detail the facial expressions (eye movements, eyebrow raises, smiles) that match the emotional tone and inflection of the delivery.
      3. Ensure the synchronization is described as "pixel-perfect" and "frame-accurate" to the rhythm of the speech.
      
      The video prompt should describe the visual scene, camera angles (e.g., close-up, wide shot, dynamic movement), and lighting for an AI video generator, matching the visual cues in the script.
      Return ONLY a valid JSON object with the following structure:
      {
        "script": "The spoken script with [Scene X: Ys - visual cues] and labels for HOOK, PAYOFF, CTA",
        "videoPrompt": "Detailed visual prompt for the AI video generator, describing camera angles, movements, and meticulous lip-syncing/jaw-sync/expression details."
      }`;
      
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              script: { type: Type.STRING },
              videoPrompt: { type: Type.STRING }
            },
            required: ["script", "videoPrompt"]
          }
        }
      });
      
      let fullText = '';
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        
        // Try to extract the script part from partial JSON
        // Look for "script": "..."
        const scriptMatch = fullText.match(/"script":\s*"((?:[^"\\]|\\.)*)"/);
        if (scriptMatch && scriptMatch[1]) {
          // Unescape basic characters if needed, but for preview raw is fine
          setScript(scriptMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
        }
      }
      
      // Final parse to get the video prompt
      try {
        const data = JSON.parse(fullText);
        if (data.script) setScript(data.script);
        if (data.videoPrompt) setVideoPrompt(data.videoPrompt);
      } catch (e) {
        console.error("Final JSON parse failed", e);
      }
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingScript(false);
  };

  const generateVoice = async () => {
    if (!script) return;
    setIsGeneratingAudio(true);
    try {
      const ai = getAI();
      const spokenText = script.replace(/\[.*?\]/g, '').trim();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: spokenText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setAudioData(base64Audio);
        setAudioUrl(createWavUrl(base64Audio));
      }
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingAudio(false);
  };

  const generateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const ai = getAI();
      let contents: any[] = [];
      
      let stylePrompt = '';
      if (imageStyle === 'ultra-realistic') {
        stylePrompt = 'Extremely ultra-realistic, raw unedited photography, highly visible skin texture, open pores, micro-details, natural imperfections, shot on 85mm lens, highly detailed face, natural lighting, 8k resolution, photorealistic, no airbrushing, hyper-authentic.';
      } else if (imageStyle === 'iphone') {
        stylePrompt = 'Shot on iPhone 15 Pro Max, front camera selfie style, casual UGC aesthetic, slightly imperfect lighting, authentic social media look, unpolished, natural.';
      } else if (imageStyle === 'short') {
        stylePrompt = 'Quick snapshot style, candid, slightly blurry background, fast shutter speed, everyday lighting, highly relatable and casual, like a quick photo taken for a friend.';
      } else if (imageStyle === 'normal') {
        stylePrompt = 'Standard digital photography, clear and well-lit, balanced colors, realistic but flattering, typical high-quality social media post, no extreme filters.';
      } else {
        stylePrompt = 'Professional studio lighting, high contrast, moody, cinematic, shot on 35mm lens, polished commercial look.';
      }

      const promptText = `A UGC style photo of a creator holding and showcasing this product: ${productDetails}. 
      The creator looks directly at the camera, engaging the viewer. 
      Style instructions: ${stylePrompt}`;

      if (characterImg) {
        const charPart = await fileToGenerativePart(characterImg.file);
        contents.push(charPart);
        contents.push({ text: `Use this person as the creator in the following scene: ${promptText}` });
      } else {
        contents.push({ text: promptText });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const url = `data:image/png;base64,${part.inlineData.data}`;
          setGeneratedImg(url);
          setGallery(prev => [...prev, { id: Date.now().toString(), type: 'image', url }]);
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingImage(false);
  };

  const generateVideo = async () => {
    if (!hasPaidKey) {
      handleSelectKey();
      return;
    }
    setIsGeneratingVideo(true);
    setVideoError('');
    setVideoProgressMsg('Initializing Veo Engine...');
    try {
      const ai = getAI(true);
      
      const promptText = videoPrompt || `A creator showcasing a product: ${productDetails}. Cinematic lighting, high quality, 35mm lens.`;
      
      let imagePayload = undefined;
      if (generatedImg) {
         const base64 = generatedImg.split(',')[1];
         const mimeType = generatedImg.split(';')[0].split(':')[1];
         imagePayload = { imageBytes: base64, mimeType };
      } else if (characterImg) {
         const base64 = await new Promise<string>((resolve) => {
           const reader = new FileReader();
           reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
           reader.readAsDataURL(characterImg.file);
         });
         imagePayload = { imageBytes: base64, mimeType: characterImg.file.type };
      }

      setVideoProgressMsg('Submitting to Veo-3...');
      let operation = await ai.models.generateVideos({
        model: 'veo-3-generate-preview',
        prompt: promptText,
        image: imagePayload,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16',
          durationSeconds: parseInt(durationSeconds)
        }
      });

      let pollCount = 0;
      const messages = [
        'Generating Video Frames...',
        'Refining Cinematic Details...',
        'Processing Motion Dynamics...',
        'Applying High-Res Textures...',
        'Finalizing Render...'
      ];

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        setVideoProgressMsg(messages[Math.min(pollCount, messages.length - 1)]);
        pollCount++;
        operation = await ai.operations.getVideosOperation({ operation });
      }

      setVideoProgressMsg('Downloading Render...');
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: { 'x-goog-api-key': process.env.API_KEY || process.env.GEMINI_API_KEY || '' },
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Download failed: ${response.status} - ${errText}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setGeneratedVideo(url);
        setGallery(prev => [...prev, { id: Date.now().toString(), type: 'video', url }]);
      }
    } catch (e: any) {
      console.error(e);
      const errMsg = e.message || JSON.stringify(e);
      if (errMsg.includes("Requested entity was not found")) {
         setVideoError("Session expired or invalid key. Please try re-selecting your API key.");
      } else if (errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED")) {
         setVideoError(`Permission Denied: Your API key doesn't have access to Veo-3.1 in project '569815811058'. Please ensure:
1. "Generative AI Video API" is ENABLED in Google Cloud Console.
2. Billing is ACTIVE for this project.
3. Your API key belongs to this project.`);
      } else {
         setVideoError(`Error: ${errMsg}`);
      }
    }
    setIsGeneratingVideo(false);
    setVideoProgressMsg('');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] font-sans p-4 md:p-8 selection:bg-[#cfff04] selection:text-black">
      <header className="flex items-center justify-between mb-8 border-b border-[#222] pb-4">
        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 rounded-full bg-[#cfff04] animate-pulse shadow-[0_0_10px_#cfff04]" />
          <h1 className="font-mono text-sm tracking-[0.2em] text-[#cfff04] uppercase">UGC_AD_ENGINE_V1</h1>
        </div>
        <div className="px-3 py-1 rounded border border-[#222] bg-[#0a0a0a] font-mono text-[10px] text-[#737373] uppercase tracking-widest">
          Status: Online
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
        <div className="lg:col-span-3 space-y-6">
          <Card title="Active Construct" icon={User}>
            <ImageUploadBox 
              image={characterImg} 
              onUpload={(e: any) => handleImageUpload(e, 'character')} 
              label="Upload Character" 
            />
          </Card>
          
          <Card title="Product Scan" icon={Box}>
            <ImageUploadBox 
              image={productImg} 
              onUpload={(e: any) => handleImageUpload(e, 'product')} 
              label="Upload Product" 
            />
            <Button 
              onClick={analyzeProduct} 
              disabled={!productImg || isAnalyzing}
              loading={isAnalyzing}
              className="w-full mt-2"
            >
              Extract Features
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card title="Vision Output" icon={Wand2}>
            {productTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {productTags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 rounded border border-[#cfff04]/30 text-[#cfff04] font-mono text-[10px] uppercase tracking-wider bg-[#cfff04]/5 flex items-center gap-1">
                    <Sparkles size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="bg-[#050505] border border-[#222] rounded p-4 min-h-[100px] font-mono text-xs text-[#a3a3a3] leading-relaxed">
              {productDetails || "Awaiting product scan..."}
            </div>
          </Card>

          <Card title="UGC Narrative" icon={FileText}>
            <div className="space-y-4">
              <div>
                <label className="text-[#737373] font-mono text-[10px] uppercase tracking-widest mb-2 block">Optional Instructions (One Line)</label>
                <input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="e.g., Make it energetic and mention a 20% discount..."
                  className="w-full bg-[#050505] border border-[#222] rounded p-3 font-sans text-xs text-[#e5e5e5] focus:outline-none focus:border-[#cfff04]"
                />
              </div>
              <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[#737373] font-mono text-[10px] uppercase tracking-widest mb-2 block">Language</label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-[#050505] border border-[#222] rounded p-2 font-mono text-xs text-[#e5e5e5] focus:outline-none focus:border-[#cfff04] cursor-pointer"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[#737373] font-mono text-[10px] uppercase tracking-widest mb-2 block">Voice</label>
                <select 
                  value={voice} 
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full bg-[#050505] border border-[#222] rounded p-2 font-mono text-xs text-[#e5e5e5] focus:outline-none focus:border-[#cfff04] cursor-pointer"
                >
                  {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[#737373] font-mono text-[10px] uppercase tracking-widest block">Spoken Script (Editable)</label>
                  <div className="flex gap-3">
                    <button 
                      onClick={saveToLibrary}
                      disabled={!script}
                      className="text-[#cfff04] hover:text-white font-mono text-[9px] uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      Save to Library
                    </button>
                    <button 
                      onClick={() => setScript('')}
                      className="text-[#555] hover:text-[#cfff04] font-mono text-[9px] uppercase tracking-widest transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Script will be generated here..."
                  className="w-full bg-[#050505] border border-[#222] rounded p-4 min-h-[160px] font-sans text-sm text-[#e5e5e5] focus:outline-none focus:border-[#cfff04] resize-y leading-relaxed"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[#737373] font-mono text-[10px] uppercase tracking-widest block">Veo Video Prompt (Editable)</label>
                  <button 
                    onClick={() => setVideoPrompt('')}
                    className="text-[#555] hover:text-[#cfff04] font-mono text-[9px] uppercase tracking-widest transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Video prompt will be generated here..."
                  className="w-full bg-[#050505] border border-[#222] rounded p-4 min-h-[80px] font-mono text-xs text-[#a3a3a3] focus:outline-none focus:border-[#cfff04] resize-y leading-relaxed"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button 
                onClick={generateScript} 
                disabled={!productDetails || isGeneratingScript}
                loading={isGeneratingScript}
                className="flex-1"
              >
                Generate Script
              </Button>
              <Button 
                onClick={generateVoice} 
                disabled={!script || isGeneratingAudio}
                loading={isGeneratingAudio}
                variant="secondary"
                className="flex-1"
              >
                Synthesize Voice
              </Button>
            </div>
            {audioData && (
              <div className="mt-4 p-3 border border-[#cfff04]/30 bg-[#cfff04]/5 rounded flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#cfff04] font-mono text-xs uppercase tracking-widest">
                  <Volume2 size={14} />
                  <span>Audio Ready</span>
                </div>
                <button 
                  onClick={() => playPcm(audioData)}
                  className="p-2 bg-[#cfff04] text-black rounded-full hover:bg-white transition-colors"
                >
                  <Play size={14} fill="currentColor" className="ml-0.5" />
                </button>
              </div>
            )}
          </div>
        </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card title="Master Render" icon={renderMode === 'image' ? Camera : Video}>
            <div className="flex bg-[#0a0a0a] border border-[#222] rounded p-1 mb-4">
              <button 
                onClick={() => setRenderMode('image')}
                className={`flex-1 font-mono text-[10px] uppercase tracking-widest py-2 rounded-sm transition-colors ${renderMode === 'image' ? 'bg-[#cfff04] text-black font-bold' : 'text-[#737373] hover:text-[#cfff04]'}`}
              >
                Image
              </button>
              <button 
                onClick={() => setRenderMode('video')}
                className={`flex-1 font-mono text-[10px] uppercase tracking-widest py-2 rounded-sm transition-colors ${renderMode === 'video' ? 'bg-[#cfff04] text-black font-bold' : 'text-[#737373] hover:text-[#cfff04]'}`}
              >
                Video
              </button>
            </div>

            {renderMode === 'image' ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button 
                    onClick={() => setImageStyle('studio')}
                    className={`flex-1 min-w-[80px] font-mono text-[9px] uppercase tracking-widest py-2 rounded border transition-colors ${imageStyle === 'studio' ? 'bg-[#cfff04]/10 border-[#cfff04] text-[#cfff04]' : 'border-[#222] text-[#737373] hover:border-[#444]'}`}
                  >
                    Studio
                  </button>
                  <button 
                    onClick={() => setImageStyle('normal')}
                    className={`flex-1 min-w-[80px] font-mono text-[9px] uppercase tracking-widest py-2 rounded border transition-colors ${imageStyle === 'normal' ? 'bg-[#cfff04]/10 border-[#cfff04] text-[#cfff04]' : 'border-[#222] text-[#737373] hover:border-[#444]'}`}
                  >
                    Normal
                  </button>
                  <button 
                    onClick={() => setImageStyle('short')}
                    className={`flex-1 min-w-[80px] font-mono text-[9px] uppercase tracking-widest py-2 rounded border transition-colors ${imageStyle === 'short' ? 'bg-[#cfff04]/10 border-[#cfff04] text-[#cfff04]' : 'border-[#222] text-[#737373] hover:border-[#444]'}`}
                  >
                    Short
                  </button>
                  <button 
                    onClick={() => setImageStyle('ultra-realistic')}
                    className={`flex-1 min-w-[80px] font-mono text-[9px] uppercase tracking-widest py-2 rounded border transition-colors ${imageStyle === 'ultra-realistic' ? 'bg-[#cfff04]/10 border-[#cfff04] text-[#cfff04]' : 'border-[#222] text-[#737373] hover:border-[#444]'}`}
                  >
                    Ultra Real
                  </button>
                  <button 
                    onClick={() => setImageStyle('iphone')}
                    className={`flex-1 min-w-[80px] font-mono text-[9px] uppercase tracking-widest py-2 rounded border transition-colors ${imageStyle === 'iphone' ? 'bg-[#cfff04]/10 border-[#cfff04] text-[#cfff04]' : 'border-[#222] text-[#737373] hover:border-[#444]'}`}
                  >
                    iPhone
                  </button>
                </div>
                <div className="w-full aspect-[3/4] bg-[#050505] border border-[#222] rounded-xl overflow-hidden relative flex items-center justify-center group">
                  {generatedImg ? (
                    <>
                      <img src={generatedImg} alt="Rendered UGC" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <span className="text-[#cfff04] font-mono text-[10px] uppercase tracking-widest border border-[#cfff04]/30 px-2 py-1 rounded bg-black/50 backdrop-blur">
                          Render Complete
                        </span>
                      </div>
                    </>
                  ) : isGeneratingImage ? (
                    <div className="flex flex-col items-center gap-4 text-[#cfff04]">
                      <Loader2 className="animate-spin" size={32} />
                      <span className="font-mono text-[10px] tracking-widest uppercase animate-pulse">Rendering Scene...</span>
                    </div>
                  ) : (
                    <div className="text-[#444] font-mono text-[10px] tracking-widest uppercase flex flex-col items-center gap-2">
                      <Camera size={24} className="opacity-50" />
                      <span>Waiting for input</span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={generateImage} 
                  disabled={(!characterImg && !productDetails) || isGeneratingImage}
                  loading={isGeneratingImage}
                  className="w-full mt-4"
                  variant="primary"
                >
                  Render Image
                </Button>
              </>
            ) : (
              <>
                {!hasPaidKey ? (
                  <div className="mb-4 p-5 border border-[#cfff04]/30 bg-[#cfff04]/5 rounded-sm flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-[#cfff04] font-mono text-[11px] uppercase tracking-[0.2em] font-bold">
                      <Sparkles size={14} />
                      <span>Vertex AI Key Required</span>
                    </div>
                    <p className="text-[10px] text-[#a3a3a3] leading-relaxed font-sans">
                      Video generation via Veo-3 is a premium feature and **requires** a paid Google Cloud project key. It is not available on the standard Gemini API.
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[#cfff04] underline ml-1 hover:text-white transition-colors">Learn more about billing</a>.
                    </p>
                    <Button onClick={handleSelectKey} variant="primary" className="w-full py-4 text-xs">
                      Select Vertex API Key
                    </Button>
                  </div>
                ) : (
                  <div className="mb-4 p-3 border border-[#cfff04]/20 bg-[#cfff04]/5 rounded-sm flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#cfff04] font-mono text-[9px] uppercase tracking-widest">
                      <Sparkles size={12} />
                      <span>Vertex AI Active</span>
                    </div>
                    <button 
                      onClick={handleResetKey}
                      className="text-[#737373] font-mono text-[8px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Change Key
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[#737373] font-mono text-[9px] uppercase tracking-widest mb-2 block">Duration (Sec)</label>
                    <div className="flex gap-2">
                      {['4', '6', '8'].map(d => (
                        <button 
                          key={d}
                          onClick={() => setDurationSeconds(d as any)}
                          className={`flex-1 font-mono text-[10px] uppercase tracking-widest py-2 rounded border transition-colors ${durationSeconds === d ? 'bg-[#cfff04]/10 border-[#cfff04] text-[#cfff04]' : 'border-[#222] text-[#737373] hover:border-[#444]'}`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="w-full aspect-[9/16] bg-[#050505] border border-[#222] rounded-xl overflow-hidden relative flex items-center justify-center group">
                  {videoError && (
                    <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center z-20">
                      <span className="text-red-500 font-mono text-[10px] uppercase tracking-widest mb-2">Render Failed</span>
                      <p className="text-[#e5e5e5] text-xs font-sans mb-4">{videoError}</p>
                      <div className="flex flex-col gap-2 w-full">
                        <Button onClick={handleResetKey} variant="primary" className="py-2">
                          Re-select API Key
                        </Button>
                        <Button onClick={() => setVideoError('')} variant="secondary" className="py-2">
                          Dismiss
                        </Button>
                      </div>
                      <div className="mt-4 text-[9px] text-[#555] font-mono uppercase tracking-tighter flex flex-col gap-1">
                        <span>Project: 569815811058</span>
                        <span>Check: Cloud Console &gt; APIs &gt; Enable "Generative AI Video API"</span>
                      </div>
                    </div>
                  )}
                  {generatedVideo ? (
                    <>
                      <video id="ugc-video" src={generatedVideo} className="w-full h-full object-cover" loop playsInline />
                      {audioUrl && <audio id="ugc-audio" src={audioUrl} />}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                          onClick={() => {
                            const vid = document.getElementById('ugc-video') as HTMLVideoElement;
                            const aud = document.getElementById('ugc-audio') as HTMLAudioElement;
                            if (vid) {
                              vid.currentTime = 0;
                              vid.play();
                            }
                            if (aud) {
                              aud.currentTime = 0;
                              aud.play();
                            }
                          }}
                          className="bg-[#cfff04] text-black p-4 rounded-full hover:scale-110 transition-transform flex items-center gap-2"
                        >
                          <Play fill="currentColor" size={20} />
                          {audioUrl && <span className="font-mono text-[10px] font-bold uppercase tracking-widest pr-2">Play with Audio</span>}
                        </button>
                      </div>
                    </>
                  ) : isGeneratingVideo ? (
                    <div className="flex flex-col items-center gap-4 text-[#cfff04]">
                      <Loader2 className="animate-spin" size={32} />
                      <span className="font-mono text-[10px] tracking-widest uppercase animate-pulse text-center px-4">
                        {videoProgressMsg || 'Rendering Video...'}<br/>
                        <span className="text-[#737373] text-[8px] mt-2 block">This may take a few minutes</span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[#444] font-mono text-[10px] tracking-widest uppercase flex flex-col items-center gap-2 text-center px-4">
                      <Video size={24} className="opacity-50" />
                      <span>Waiting for input</span>
                      <span className="text-[#737373] text-[8px] mt-2">Uses Veo-3. Requires API Key.</span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={generateVideo} 
                  disabled={(!characterImg && !productDetails && !generatedImg) || isGeneratingVideo}
                  loading={isGeneratingVideo}
                  className="w-full mt-4"
                  variant="primary"
                >
                  Render Video
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Gallery Queue */}
      {gallery.length > 0 && (
        <div className="max-w-7xl mx-auto mt-8 border-t border-[#222] pt-6">
          <h2 className="text-[#cfff04] font-mono text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sparkles size={14} />
            Generated Assets Queue
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {gallery.map(item => (
              <div 
                key={item.id} 
                className="relative w-32 h-40 flex-shrink-0 border border-[#222] rounded-lg overflow-hidden group border-[#222] hover:border-[#cfff04] transition-colors"
              >
                {item.type === 'image' ? (
                  <img src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover" />
                )}
                <div className="absolute top-2 right-2 bg-black/80 p-1.5 rounded border border-[#333]">
                  {item.type === 'image' ? <Camera size={12} className="text-[#cfff04]" /> : <Video size={12} className="text-[#cfff04]" />}
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <button 
                    onClick={() => {
                      if (item.type === 'image') {
                        setRenderMode('image');
                        setGeneratedImg(item.url);
                      } else {
                        setRenderMode('video');
                        setGeneratedVideo(item.url);
                      }
                    }}
                    className="w-full font-mono text-[9px] uppercase tracking-widest text-white bg-white/10 hover:bg-white/20 py-1.5 rounded border border-white/20 transition-all"
                  >
                    View
                  </button>
                  {item.type === 'video' && (
                    <button 
                      onClick={() => addToTimeline(item)}
                      className="w-full font-mono text-[9px] uppercase tracking-widest text-black bg-[#cfff04] hover:bg-[#e4ff4d] py-1.5 rounded font-bold transition-all"
                    >
                      Add to Timeline
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Editor */}
      <div className="max-w-7xl mx-auto mt-8 border-t border-[#222] pt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#cfff04] font-mono text-[10px] uppercase tracking-widest flex items-center gap-2">
            <Scissors size={14} />
            Video Timeline & Editor
          </h2>
          {timeline.length > 0 && (
            <Button 
              onClick={processTimeline} 
              disabled={isProcessingTimeline}
              loading={isProcessingTimeline}
              className="px-6"
            >
              Merge & Export Video
            </Button>
          )}
        </div>

        {timeline.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-dashed border-[#222] rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center text-[#444]">
              <Plus size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-[#a3a3a3] font-sans text-sm">Your timeline is empty</p>
              <p className="text-[#555] font-mono text-[10px] uppercase tracking-widest">Add clips from the gallery above to start editing</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar">
              {timeline.map((item, index) => (
                <div key={item.id} className="relative flex-shrink-0 w-64 bg-[#111] border border-[#222] rounded-lg overflow-hidden group">
                  <div className="aspect-video relative">
                    <video 
                      id={`timeline-video-${item.id}`}
                      src={item.url} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                      <span className="text-white font-mono text-[9px] bg-black/50 px-1.5 py-0.5 rounded">
                        {item.start.toFixed(1)}s - {item.end.toFixed(1)}s
                      </span>
                      <span className="text-[#cfff04] font-mono text-[9px] font-bold">
                        {(item.end - item.start).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-3">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[#555] font-mono text-[8px] uppercase tracking-widest block">Start Point</label>
                          <input 
                            type="number" 
                            step="0.1"
                            min="0"
                            max={item.end - 0.1}
                            value={item.start.toFixed(1)}
                            onChange={(e) => updateTimelineItem(item.id, { start: Math.max(0, Math.min(parseFloat(e.target.value) || 0, item.end - 0.1)) })}
                            className="bg-[#1a1a1a] border border-[#222] text-[#cfff04] font-mono text-[9px] w-12 px-1 py-0.5 rounded text-center focus:outline-none focus:border-[#cfff04]/50"
                          />
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max={item.duration} 
                          step="0.1"
                          value={item.start}
                          onChange={(e) => updateTimelineItem(item.id, { start: Math.min(parseFloat(e.target.value), item.end - 0.1) })}
                          className="w-full accent-[#cfff04] h-1 bg-[#222] rounded-full appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[#555] font-mono text-[8px] uppercase tracking-widest block">End Point</label>
                          <input 
                            type="number" 
                            step="0.1"
                            min={item.start + 0.1}
                            max={item.duration}
                            value={item.end.toFixed(1)}
                            onChange={(e) => updateTimelineItem(item.id, { end: Math.min(item.duration, Math.max(parseFloat(e.target.value) || item.duration, item.start + 0.1)) })}
                            className="bg-[#1a1a1a] border border-[#222] text-[#cfff04] font-mono text-[9px] w-12 px-1 py-0.5 rounded text-center focus:outline-none focus:border-[#cfff04]/50"
                          />
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max={item.duration} 
                          step="0.1"
                          value={item.end}
                          onChange={(e) => updateTimelineItem(item.id, { end: Math.max(parseFloat(e.target.value), item.start + 0.1) })}
                          className="w-full accent-[#cfff04] h-1 bg-[#222] rounded-full appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                      <div className="flex gap-1">
                        <button 
                          onClick={() => {
                            const video = document.getElementById(`timeline-video-${item.id}`) as HTMLVideoElement;
                            if (video) {
                              video.currentTime = item.start;
                              video.play();
                              const checkEnd = () => {
                                if (video.currentTime >= item.end) {
                                  video.pause();
                                  video.removeEventListener('timeupdate', checkEnd);
                                }
                              };
                              video.addEventListener('timeupdate', checkEnd);
                            }
                          }}
                          className="p-1.5 rounded bg-[#1a1a1a] text-[#737373] hover:text-[#cfff04] transition-colors"
                          title="Preview Trimmed Clip"
                        >
                          <Play size={12} />
                        </button>
                        <div className="w-px h-4 bg-[#222] mx-1" />
                        <button 
                          onClick={() => moveTimelineItem(index, 'left')}
                          disabled={index === 0}
                          className="p-1.5 rounded bg-[#1a1a1a] text-[#737373] hover:text-[#cfff04] disabled:opacity-30"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button 
                          onClick={() => moveTimelineItem(index, 'right')}
                          disabled={index === timeline.length - 1}
                          className="p-1.5 rounded bg-[#1a1a1a] text-[#737373] hover:text-[#cfff04] disabled:opacity-30"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromTimeline(item.id)}
                        className="p-1.5 rounded bg-[#1a1a1a] text-[#737373] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Script Library */}
      {scriptLibrary.length > 0 && (
        <div className="max-w-7xl mx-auto mt-8 border-t border-[#222] pt-6">
          <h2 className="text-[#cfff04] font-mono text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
            <FileText size={14} />
            Script Library / Viral Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scriptLibrary.map(entry => (
              <div key={entry.id} className="bg-[#111] border border-[#222] rounded-lg p-4 flex flex-col gap-3 hover:border-[#cfff04]/50 transition-colors group">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[#e5e5e5] font-sans text-xs font-bold line-clamp-1">{entry.title}</span>
                    <span className="text-[#737373] font-mono text-[8px] uppercase tracking-widest">{entry.date}</span>
                  </div>
                  <button 
                    onClick={() => deleteFromLibrary(entry.id)}
                    className="text-[#555] hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[#a3a3a3] text-[10px] line-clamp-3 font-sans italic">
                  {entry.script.substring(0, 100)}...
                </p>
                <div className="flex gap-2 mt-auto">
                  <button 
                    onClick={() => loadFromLibrary(entry)}
                    className="flex-1 bg-[#cfff04]/10 border border-[#cfff04]/30 text-[#cfff04] font-mono text-[9px] uppercase tracking-widest py-1.5 rounded hover:bg-[#cfff04] hover:text-black transition-all"
                  >
                    Load Script
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
