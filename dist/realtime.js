// Supabase Realtime protocol v1. Only invalidations; never board data or room keys.
(function (root) {
  function connectRealtime({url,key,topic,onChange,onStatus,WebSocketImpl=root.WebSocket}) {
    let socket, retry, heartbeat, joinTimer, stopped=false, joined=false, ref=0, heartbeatRef=null;
    const channel='realtime:'+topic;
    const send=(event,payload,channelName=channel)=>{
      const id=String(++ref);
      if(socket?.readyState===1)socket.send(JSON.stringify({topic:channelName,event,payload,ref:id,join_ref:channelName===channel?'1':undefined}));
      return id;
    };
    function connect(){
      if(stopped)return;
      const endpoint=new URL('/realtime/v1/websocket',url);
      endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
      endpoint.searchParams.set('apikey',key);endpoint.searchParams.set('vsn','1.0.0');
      ref=0;joined=false;heartbeatRef=null;onStatus(false);
      try{socket=new WebSocketImpl(endpoint.href)}catch{retry=setTimeout(connect,3000);return}
      socket.onopen=()=>{
        send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:false}});
        joinTimer=setTimeout(()=>socket.close(),10000);
        heartbeat=setInterval(()=>{
          if(heartbeatRef){socket.close();return}
          heartbeatRef=send('heartbeat',{},'phoenix');
        },25000);
      };
      socket.onmessage=event=>{
        let msg;try{msg=JSON.parse(event.data)}catch{return}
        if(msg.event==='phx_reply'&&msg.ref===heartbeatRef)heartbeatRef=null;
        if(msg.topic!==channel)return;
        if(msg.event==='phx_reply'&&msg.ref==='1'){
          if(msg.payload?.status==='ok'){clearTimeout(joinTimer);joined=true;onStatus(true);onChange()}
          else socket.close();
        }
        if(msg.event==='broadcast'&&msg.payload?.event==='changed')onChange();
        if(msg.event==='phx_error'||msg.event==='phx_close')socket.close();
      };
      socket.onerror=()=>socket.close();
      socket.onclose=()=>{joined=false;clearInterval(heartbeat);clearTimeout(joinTimer);onStatus(false);if(!stopped)retry=setTimeout(connect,3000)};
    }
    connect();
    return {
      notify(){if(joined)send('broadcast',{type:'broadcast',event:'changed',payload:{}})},
      close(){stopped=true;clearTimeout(retry);clearTimeout(joinTimer);clearInterval(heartbeat);socket?.close()}
    };
  }
  root.IskraRealtime={connectRealtime};
  if(typeof module!=='undefined')module.exports=root.IskraRealtime;
})(globalThis);
