"use client";
import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const Stream: React.FC = () => {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  // Setup WebSocket connection
  const setupWebSocket = () => {
    if (websocketRef.current) return;
    console.log("hello")
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8080/v1/stream`;
    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;
    
    ws.onmessage = evt => {
      const msg = JSON.parse(evt.data);
      if (!msg) return console.log('Failed to parse message');
      
      if (!peerConnectionRef.current) return;
      
      switch (msg.event) {
        case 'offer':
          const offer = JSON.parse(msg.data);
          if (!offer) return console.log('Failed to parse offer');
          
          peerConnectionRef.current.setRemoteDescription(offer);
          peerConnectionRef.current.createAnswer().then(answer => {
            if (peerConnectionRef.current) {
              peerConnectionRef.current.setLocalDescription(answer);
              ws.send(JSON.stringify({
                event: 'answer',
                data: JSON.stringify(answer)
              }));
            }
          });
          break;
          
        case 'candidate':
          const candidate = JSON.parse(msg.data);
          if (!candidate) return console.log('Failed to parse candidate');
          peerConnectionRef.current.addIceCandidate(candidate);
          break;
      }
    };
    
    ws.onclose = () => console.log('WebSocket closed');
    ws.onerror = error => console.error('WebSocket error:', error);
  };
  
  // Start screen sharing when user clicks the button
  const startScreenSharing = async () => {
    try {
      setupWebSocket();
      
      // Get screen sharing stream
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      
      // Display local stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
      
      // Handle ICE candidates
      pc.onicecandidate = e => {
        if (!e.candidate || !websocketRef.current) return;
        websocketRef.current.send(JSON.stringify({
          event: 'candidate',
          data: JSON.stringify(e.candidate)
        }));
      };
      
      // Handle remote tracks
      pc.ontrack = event => {
        if (event.track.kind === 'audio') return;
        
        const el = document.createElement(event.track.kind);
        el.srcObject = event.streams[0];
        el.autoplay = true;
        el.controls = true;
        
        remoteVideosRef.current?.appendChild(el);
        
        // Handle track removal
        event.streams[0].onremovetrack = ({track}) => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        };
      };
      
      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        
        // Handle local track stopping
        track.onended = () => {
          stopScreenSharing();
        };
      });
      
      setIsSharing(true);
    } catch (error) {
      console.error('Error starting screen share:', error);
    }
  };
  
  // Stop screen sharing
  const stopScreenSharing = () => {
    // Stop all media tracks
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Close WebSocket connection
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    setIsSharing(false);
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">WebRTC Screen Sharing</h1>
        <button 
          onClick={() => router.push('/')}
          className="mt-2 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
        >
          Back to Lobby
        </button>
      </header>

      <div className="space-y-6">
        <div>
          <h3 className="text-xl mb-2">Local Video</h3>
          <div className="relative bg-black rounded w-[400px] h-[300px]">
            {!isSharing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p>No video</p>
              </div>
            )}
            <video 
              ref={localVideoRef}
              width="400" 
              height="300" 
              autoPlay 
              muted 
              className="rounded"
            />
          </div>
          
          <div className="mt-4">
            {!isSharing ? (
              <button 
                onClick={startScreenSharing}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Share Screen
              </button>
            ) : (
              <button 
                onClick={stopScreenSharing}
                className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
              >
                Stop Sharing
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xl mb-2">Remote Videos</h3>
          <div 
            ref={remoteVideosRef}
            className="p-4 bg-gray-800 rounded min-h-[300px]"
          />
        </div>
      </div>
    </div>
  );
};

export default Stream;