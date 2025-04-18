"use client";

import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';

interface WebsocketMessage {
  event: string;
  data: string;
}

export default function Home() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<RTCPeerConnection | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  
  // Refs to hold current instances
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const addLogMessage = (message: string): void => {
    if (logsRef.current) {
      const logElement = document.createElement('div');
      logElement.textContent = message;
      logsRef.current.appendChild(logElement);
    }
  };

  // Clean up function to properly close connections
  const cleanupConnections = () => {
    // Close peer connection if it exists
    if (connection) {
      connection.close();
      setConnection(null);
    }
    
    // Close websocket if it exists
    if (websocket) {
      websocket.close();
      setWebsocket(null);
    }
    
    // Stop all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Clear remote videos container
    if (remoteVideosRef.current) {
      remoteVideosRef.current.innerHTML = '';
    }
    
    setIsSharing(false);
    pendingIceCandidatesRef.current = [];
  };

  const startScreenShare = async (): Promise<void> => {
    // Clean up any existing connections first
    cleanupConnections();
    
    try {
      // Request screen sharing
      localStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      
      // Set up WebRTC peer connection
      const pc = new RTCPeerConnection();
      setConnection(pc);
      
      // Add local tracks to peer connection
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
        // Handle track ending (user stops sharing)
        track.onended = () => {
          addLogMessage("Screen sharing ended by user");
          cleanupConnections();
        };
      });
      
      // Set remoteDescriptionSet flag
      let remoteDescriptionSet = false;
      
      // Function to add buffered ICE candidates
      const addPendingIceCandidates = () => {
        if (pc && remoteDescriptionSet) {
          addLogMessage(`Adding ${pendingIceCandidatesRef.current.length} pending ICE candidates`);
          pendingIceCandidatesRef.current.forEach(candidate => {
            void pc.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(err => addLogMessage(`Error adding buffered ICE candidate: ${err}`));
          });
          pendingIceCandidatesRef.current = [];
        }
      };
      
      // Handle incoming tracks from remote peer
      pc.ontrack = function (event: RTCTrackEvent) {
        if (event.track.kind === 'audio') {
          return;
        }
        
        const el = document.createElement(event.track.kind);
        el.srcObject = event.streams[0];
        el.autoplay = true;
        
        if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
          el.controls = true;
        }
        
        if (remoteVideosRef.current) {
          remoteVideosRef.current.appendChild(el);
        }
        
        event.track.onmute = function() {
          if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
            void el.play();
          }
        };
        
        event.streams[0].onremovetrack = ({track}): void => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        };
      };
      
      // Set up WebSocket connection
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080/v1/stream";
      const ws = new WebSocket(wsUrl);
      setWebsocket(ws);
      
      // Handle ICE candidates
      pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
        if (!e.candidate || !ws) {
          return;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({event: 'candidate', data: JSON.stringify(e.candidate)}));
          addLogMessage("Sent ICE candidate");
        }
      };
      
      // WebSocket event handlers
      ws.onclose = function() {
        addLogMessage("WebSocket connection closed");
        alert("WebSocket has closed");
        cleanupConnections();
      };
      
      ws.onmessage = async function(evt: MessageEvent) {
        try {
          const msg = JSON.parse(evt.data) as WebsocketMessage;
          if (!msg) {
            return addLogMessage('Failed to parse message');
          }
          
          switch (msg.event) {
            case 'offer':
              try {
                const offer = JSON.parse(msg.data) as RTCSessionDescriptionInit;
                if (!offer || !pc) {
                  return addLogMessage('Failed to parse offer or peer connection is null');
                }
                
                addLogMessage("Received offer - setting remote description");
                await pc.setRemoteDescription(offer);
                remoteDescriptionSet = true;
                addPendingIceCandidates();
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({event: 'answer', data: JSON.stringify(answer)}));
                  addLogMessage("Sent answer");
                }
              } catch (error) {
                addLogMessage(`Error processing offer: ${error}`);
              }
              break;
              
            case 'candidate':
              try {
                const candidate = JSON.parse(msg.data) as RTCIceCandidateInit;
                if (!candidate) {
                  return addLogMessage('Failed to parse candidate');
                }
                
                if (!pc) {
                  return addLogMessage('Peer connection is null');
                }
                
                if (remoteDescriptionSet) {
                  // If remote description is set, add candidate directly
                  addLogMessage("Adding ICE candidate immediately");
                  void pc.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(err => {
                      addLogMessage(`Error adding ICE candidate: ${err}`);
                    });
                } else {
                  // Otherwise buffer the candidate
                  addLogMessage("Buffering ICE candidate for later");
                  pendingIceCandidatesRef.current.push(candidate);
                }
              } catch (error) {
                addLogMessage(`Error processing candidate: ${error}`);
              }
              break;
              
            default:
              addLogMessage(`Unknown event: ${msg.event}`);
          }
        } catch (error) {
          addLogMessage(`Error handling message: ${error}`);
        }
      };
      
      ws.onerror = function(evt: Event) {
        const error = evt as ErrorEvent;
        addLogMessage(`ERROR: ${error.message || 'WebSocket error occurred'}`);
      };
      
      setIsSharing(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.toString() : 'Unknown error';
      alert(errorMessage);
      addLogMessage(`Error: ${errorMessage}`);
      cleanupConnections();
    }
  };

  // Trigger screen share when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      void startScreenShare();
      
      // Clean up on unmount
      return () => {
        cleanupConnections();
      };
    }
  }, []);

  return (
    <>
      <Head>
        <title>WebRTC Screen Sharing</title>
        <meta charSet="utf-8" />
      </Head>
      <div className="container">
        <h3>Local Video</h3>
        <video 
          id="localVideo" 
          ref={localVideoRef} 
          width={160} 
          height={120} 
          autoPlay 
          muted 
        />
        
        <h3>Remote Video</h3>
        <div id="remoteVideos" ref={remoteVideosRef}></div>
        
        <div className="controls">
          <button 
            onClick={() => void startScreenShare()} 
            disabled={isSharing}
          >
            {isSharing ? 'Already Sharing' : 'Start Screen Share'}
          </button>
          <button 
            onClick={cleanupConnections} 
            disabled={!isSharing}
          >
            Stop Sharing
          </button>
        </div>
        
        <h3>Logs</h3>
        <div id="logs" ref={logsRef}></div>
      </div>
    </>
  );
}