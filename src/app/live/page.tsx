"use client";
import Image from 'next/image';
import React, { useEffect, useState } from 'react'


export default function Live() {

    const [startRecording,setStartRecording] = useState<boolean>(false)
    const [elapsedTime,setElapsedTime]= useState<number>(0);

    useEffect(()=>{
        let timer: NodeJS.Timeout | number;
        if(startRecording){
            timer = setInterval(()=>{
                setElapsedTime((prev)=>prev+1)
            },1000)
        }
        return ()=> clearInterval(timer);
    },[startRecording])
 

    const handleStream = () =>{
        console.log('StreamStarted')
        setStartRecording(true)
    }
    const handleEndStream = () =>{
        console.log("stream Ended")
        setStartRecording(false)
        setElapsedTime(0)
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
     {!startRecording &&     <div
          onClick={handleStream}
          className={`rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground  hover:bg-[#383838] dark:hover:bg-[#ccc]  text-background gap-2 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto`}
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
          className={`rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-600 dark'  text-background gap-2 font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto`}
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
