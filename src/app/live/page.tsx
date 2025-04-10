"use client";
import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react'


export default function Live() {

    const [startRecording,setStartRecording] = useState<boolean>(false)
    const [elapsedTime,setElapsedTime]= useState<number>(0);
    // const [blob,setBlob]=useState<string>('');
    // const [chunks,setChunks]=useState<string[]>([]);
    const [videoUrl,setVideoUrl]= useState<string>('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordedChunksRef = useRef<Blob[]>([])
    const videoElementRef = useRef(null)

    const constraints:object = {video:{
        frameRate:{
            ideal:30,
            max:60
        }
    },audio : 'true'};


//    navigator.mediaDevices.getUserMedia(constraints).then((stream)=>{
//         const mediaRecorder = new MediaRecorder(stream);
//     }) 


    useEffect(()=>{
        let timer: NodeJS.Timeout | number;
        if(startRecording){
            timer = setInterval(()=>{
                setElapsedTime((prev)=>prev+1)
            },1000)
        }
        return ()=> clearInterval(timer);
    },[startRecording])
 
    
    const handleStream = async  () =>{
        console.log('StreamStarted')
        setStartRecording(true)
        try{
            // requesting screen capture
            const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

            //creating mailrecorder instance

            mediaRecorderRef.current = new MediaRecorder(stream);

            //collect recorder video chunks 
            mediaRecorderRef.current.ondataavailable =(event:BlobEvent) =>{
                if(event.data.size > 0){
                    console.log('chunks generating',event.data)
                    recordedChunksRef.current.push(event.data)
                }
            }

            //when recording stops , save the video to localstorage 
            mediaRecorderRef.current.onstop=()=>{
                const recordedBlob = new Blob(recordedChunksRef.current,{type: 'video/webm'})

                //convert blob to URL and save to localstorage 
                const recordedUrl = URL.createObjectURL(recordedBlob);
                console.log('url',recordedUrl)
                
                //save to localstorage
                setVideoUrl(recordedUrl);
            }

            //start Recording
            mediaRecorderRef.current.start(1000);


        }
        catch (err){
            console.log('Error starting screen recording',err)
        }
        // mediaRecorder.start();
     }
    const handleEndStream = () =>{
        if(mediaRecorderRef.current){
            mediaRecorderRef.current.stop();
            console.log("stream Ended")
            setStartRecording(false)
            setElapsedTime(0)
        }
    }

    const formatTimestamp = (seconds:number) =>{
       const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;   
    }
  return (
    <div>

    <div>Live</div>
    {
        videoUrl && 
(
          <>
            <h3>Playback Recorded Video</h3>
            <video
              ref={videoElementRef}
              controls
              src={videoUrl}
              width="600"
              height="400"
            ></video>
          </>
)
    }
     {!startRecording &&     <div
          onClick={handleStream}
          className={`rounded-full border border-solid cursor-pointer border-transparent transition-colors flex items-center justify-center bg-foreground  hover:bg-[#383838] dark:hover:bg-[#ccc]  text-background gap-2 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto`}
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
              />
            Start Stream
              </div>}
{  startRecording &&        <div
          onClick={handleEndStream}
          className={`rounded-full border border-solid border-transparent cursor-pointer transition-colors flex items-center justify-center bg-red-600 dark'  text-background gap-2 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto`}
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
              />
            Stop Stream 
            ({formatTimestamp(elapsedTime)})
              </div>
}
              </div>
 
  )
}
