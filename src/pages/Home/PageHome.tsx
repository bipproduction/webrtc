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
import SocketManager from "../../lib/SocketManager";

const BUN_PUBLIC_APP_STUN_URL = process.env.BUN_PUBLIC_APP_STUN_URL;
if (!BUN_PUBLIC_APP_STUN_URL) {
  throw new Error("BUN_PUBLIC_APP_STUN_URL not found");
}
const ICE_SERVERS = [{ urls: BUN_PUBLIC_APP_STUN_URL }];
const isDev = process.env.NODE_ENV === "development";

const getUserId = (): string => {
  const id = localStorage.getItem("id") || crypto.randomUUID();
  localStorage.setItem("id", id);
  return id;
};

const Home = () => {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const socket = SocketManager.getInstance();

  const [started, setStarted] = useState(false);
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "user";
  const deviceName = searchParams.get("deviceName") || "default";
  const isDebug = isDev || JSON.parse(searchParams.get("isDebug") || "false");
  const [users, setUsers] = useState<
    { id: string; role: string; deviceName: string }[]
  >([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string[]>([]);

  const registerUser = useCallback(() => {
    const id = getUserId();
    setDeviceId(id);
    socket.safeSend({ type: "req-register", id, role, deviceName });
    if (isDebug) console.log("🟢 Client registered: " + id);
  }, [deviceName, isDebug, role]);

  const handleMessage = useCallback(
    async (msg: any) => {
      const pc = pcRef.current;
      if (!pc) return;

      const id = getUserId();
      switch (msg.type) {
        case "restart":
          window.location.reload();
          return;
        case "res-list-user":
          if (role !== "host") return;
          const filtered = (msg.users || []).filter((u: any) => u.id !== id);
          setUsers(filtered);
          if (isDebug) console.log("🟢 List updated", filtered);
          return;
      }

      if (
        msg.selectedDeviceId?.includes(id) &&
        msg.offer &&
        pc.signalingState === "stable"
      ) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localRef.current) localRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.safeSend({ answer });
        pendingCandidates.current.forEach((c) =>
          pc.addIceCandidate(new RTCIceCandidate(c))
        );
        pendingCandidates.current = [];
        setStarted(true);
      }

      if (msg.answer && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        pendingCandidates.current.forEach((c) =>
          pc.addIceCandidate(new RTCIceCandidate(c))
        );
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
    },
    [isDebug, role]
  );

  useShallowEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.safeSend({ candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
    };

    socket.configure({
      onMessage: handleMessage,
      onOpen: () => {
        if (socket.socket) {
          wsRef.current = socket.socket;
          registerUser();
        }
      },
      debug: isDebug,
    });

    socket.connect();

    const interval = setInterval(() => {
      if (socket.socket && socket.socket !== wsRef.current) {
        wsRef.current = socket.socket;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      socket.cleanup();
    };
  }, []);

  async function startCall() {
    const pc = pcRef.current;
    if (!pc) return;

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
    socket.safeSend({ offer, selectedDeviceId });
    setStarted(true);
  }

  const UserView = () => (
    <Stack justify="center" align="center" p="md" bg={"gray.2"} h={"30rem"}>
      <Stack display={started ? "none" : ""} align="center">
        <Text size="3rem">{deviceName}</Text>
        <Text size="1.5rem">{deviceId}</Text>
      </Stack>
      <Text c="green" display={started ? "" : "none"}>
        <MonitorUp size="6rem" />
      </Text>
    </Stack>
  );

  const HostView = () => (
    <Stack>
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
              onClick={startCall}
              disabled={started || selectedDeviceId.length === 0}
            >
              Start Call
            </Button>
            <Button
              color="red"
              onClick={() => socket.safeSend({ type: "restart" })}
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
    </Stack>
  );

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
            display={role === "host" ? "" : "none"}
            onClick={() => socket.safeSend({ type: "restart" })}
          >
            <RefreshCcw />
          </ActionIcon>
        </Flex>
        <Text>Role: {role}</Text>
        <Text>Users: {deviceId}</Text>
        {role === "host" ? <HostView /> : <UserView />}
      </Stack>
    </Container>
  );
};

export default Home;
