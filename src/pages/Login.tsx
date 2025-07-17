import { login } from "@/lib/state-login";
import { Container, Stack, Title, Text } from "@mantine/core";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";

const CLIENT_ID = process.env.BUN_PUBLIC_APP_GOOGLE_CLIENT_ID;
if (!CLIENT_ID) {
  throw new Error("BUN_PUBLIC_APP_GOOGLE_CLIENT_ID not found");
}
const clientId = CLIENT_ID;

export default function Login() {
  const navigate = useNavigate();

  return (
    <Container size="xs" py="xl">
      <Stack gap="md" align="center">
        <Title order={2}>WebRTC</Title>
        <GoogleOAuthProvider clientId={clientId}>
          <GoogleLogin
            onSuccess={(response) => {
              if (response.credential) {
                login(response.credential); // simpan ke valtio
                navigate("/");
              }
            }}
            onError={() => {
              console.log("Login Failed");
            }}
          />
        </GoogleOAuthProvider>
      </Stack>
    </Container>
  );
}
