// Refactored Home.tsx with isolated WebSocket management

import {
    ActionIcon,
    Box,
    Button,
    Card,
    Checkbox,
    Container,
    Flex,
    Group,
    Paper,
    Stack,
    Text,
    Title,
  } from "@mantine/core";
  import { useShallowEffect } from "@mantine/hooks";
  import { MonitorUp, RefreshCcw } from "lucide-react";
  import { useRef, useState, useCallback } from "react";
  import { useSearchParams } from "react-router-dom";
  
  const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
  const WS_URL = process.env.BUN_PUBLIC_APP_WS_AUDIO_URL;
  const isDev = process.env.NODE_ENV === "development";
  
  const getUserId = (): string => {
    const id = localStorage.getItem("id") || crypto.randomUUID();
    localStorage.setItem("id", id);
    return id;
  };
  
  const safeSend = (ws: WebSocket, data: any, debug: boolean) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      } else if (debug) {
        console.warn("❌ Tried to send on closed WebSocket");
      }
    } catch (e) {
      if (debug) console.error("❌ safeSend failed", e);
    }
  };
  
  function useWebSocket(
    handleMessage: (msg: any) => void,
    onOpen: () => void,
    debug = false
  ) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(1000);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
    const cleanup = () => {
      if (debug) console.log("🔌 Cleaning up WebSocket and intervals");
      wsRef.current?.close();
      wsRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  
    const connect = () => {
      if (!WS_URL) throw new Error("WS URL not found");
      cleanup();
  
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
  
      ws.onopen = () => {
        if (debug) console.log("✅ WebSocket connected");
        onOpen();
        reconnectDelayRef.current = 1000;
        pingIntervalRef.current = setInterval(() => {
          safeSend(ws, { type: "ping" }, debug);
        }, 10_000);
      };
  
      ws.onclose = () => {
        if (debug)
          console.warn(
            `❌ WebSocket closed. Reconnecting in ${reconnectDelayRef.current / 1000}s`
          );
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            30_000
          );
          connect();
        }, reconnectDelayRef.current);
      };
  
      ws.onerror = () => {
        if (debug) console.error("🚨 WebSocket error, will reconnect");
        ws.close();
      };
  
      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data);
          handleMessage(msg);
        } catch (e) {
          if (debug) console.error("Invalid WS message", e);
        }
      };
    };
  
    return { wsRef, connect, cleanup };
  }
  
  const Home = () => {
    const localRef = useRef<HTMLVideoElement | null>(null);
    const remoteRef = useRef<HTMLVideoElement | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  
    const [started, setStarted] = useState(false);
    const [searchParams] = useSearchParams();
    const role = searchParams.get("role") || "user";
    const deviceName = searchParams.get("deviceName") || "default";
    const isDebug = isDev || JSON.parse(searchParams.get("isDebug") || "false");
    const [users, setUsers] = useState<{ id: string; role: string; deviceName: string }[]>([]);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string[]>([]);
  
    const registerUser = useCallback((ws: WebSocket) => {
      const id = getUserId();
      setDeviceId(id);
      safeSend(ws, { type: "req-register", id, role, deviceName }, isDebug);
      if (isDebug) console.log("🟢 Client registered: " + id);
    }, [deviceName, isDebug, role]);
  
    const handleMessage = useCallback(async (msg: any) => {
      const pc = pcRef.current;
      if (!pc) return;
  
      const id = getUserId();
      switch (msg.type) {
        case "restart":
          window.location.reload();
          return;
        case "res-list-user": {
          if (role !== "host") return;
          const filtered = (msg.users || []).filter((u: any) => u.id !== id);
          setUsers(filtered);
          if (isDebug) console.log("🟢 List updated", filtered);
          return;
        }
      }
  
      if (msg.selectedDeviceId?.includes(id) && msg.offer && pc.signalingState === "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localRef.current) localRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        safeSend(wsRef.current!, { answer }, isDebug);
        pendingCandidates.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
        pendingCandidates.current = [];
        setStarted(true);
      }
  
      if (msg.answer && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        pendingCandidates.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
        pendingCandidates.current = [];
      }
  
      if (msg.candidate) {
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.error("[ICE] Add error", e);
          }
        } else {
          pendingCandidates.current.push(msg.candidate);
        }
      }
    }, [isDebug, role]);
  
    const { wsRef, connect: connectWebSocket, cleanup } = useWebSocket(
      handleMessage,
      () => registerUser(wsRef.current!),
      isDebug
    );
  
    useShallowEffect(() => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
  
      pc.onicecandidate = (e) => {
        if (e.candidate) safeSend(wsRef.current!, { candidate: e.candidate }, isDebug);
      };
  
      pc.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
      };
  
      connectWebSocket();
      return cleanup;
    }, [connectWebSocket, cleanup]);
  
    return (
      <Container>
        <Stack>
          <Flex align="center" gap="md">
            <Title>WebRTC</Title>
            {process.env.NODE_ENV}
            <ActionIcon
              disabled={started}
              variant="subtle"
              radius={100}
              onClick={() => wsRef.current?.send(JSON.stringify({ type: "restart" }))}
            >
              <RefreshCcw />
            </ActionIcon>
          </Flex>
          <Text>Role: {role}</Text>
          <Text>Users: {deviceId}</Text>
          {role !== "host" ? (
            <Stack h="100vh" justify="center" align="center">
              <Stack display={started ? "none" : ""} align="center">
                <Text size="3rem">{deviceName}</Text>
                <Text size="1.5rem">{deviceId}</Text>
              </Stack>
              <Text c="green" display={started ? "" : "none"}>
                <MonitorUp size="6rem" />
              </Text>
            </Stack>
          ) : (
            <>
              <Card withBorder>
                <Stack>
                  {users.map((v, k) => (
                    <Stack key={k}>
                      <Flex gap="md" align="start">
                        <Checkbox
                          disabled={started}
                          checked={selectedDeviceId.includes(v.id)}
                          onChange={() => setSelectedDeviceId([v.id])}
                        />
                        <Stack gap="xs">
                          <Text size="1.5rem" fw="bold">
                            {v.deviceName}
                          </Text>
                          <Text size="1rem">{v.id}</Text>
                        </Stack>
                      </Flex>
                    </Stack>
                  ))}
                  <Group justify="end">
                    <Button
                      color="cyan"
                      onClick={async () => {
                        if (!pcRef.current || !wsRef.current) return;
                        const pc = pcRef.current;
                        const ws = wsRef.current;
  
                        const stream = new MediaStream();
  
                        const audioCtx = new AudioContext();
                        const oscillator = audioCtx.createOscillator();
                        const dst = audioCtx.createMediaStreamDestination();
                        oscillator.connect(dst);
                        oscillator.start();
                        dst.stream.getTracks().forEach((track) => stream.addTrack(track));
  
                        const canvas = document.createElement("canvas");
                        canvas.width = 640;
                        canvas.height = 480;
                        const ctx = canvas.getContext("2d");
                        if (ctx) {
                          ctx.fillStyle = "black";
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        const videoStream = canvas.captureStream(1);
                        videoStream.getTracks().forEach((track) => stream.addTrack(track));
  
                        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        safeSend(ws, { offer, selectedDeviceId }, isDebug);
                        setStarted(true);
                      }}
                      disabled={started || selectedDeviceId.length === 0}
                    >
                      Start Call
                    </Button>
                    <Button
                      color="red"
                      onClick={() => wsRef.current?.send(JSON.stringify({ type: "restart" }))}
                      disabled={!started}
                    >
                      End Call
                    </Button>
                  </Group>
                </Stack>
              </Card>
              <Paper p="md" withBorder w="100%">
                <Stack>
                  <Box>
                    <video
                      ref={remoteRef}
                      autoPlay
                      playsInline
                      controls
                      muted
                      style={{
                        transform: "scaleX(-1)",
                        width: "100%",
                        height: "auto",
                      }}
                    />
                  </Box>
                </Stack>
              </Paper>
            </>
          )}
        </Stack>
      </Container>
    );
  };
  
  export default Home;
  