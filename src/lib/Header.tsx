import { Button, Group, Text, Avatar } from "@mantine/core";
import { useSnapshot } from "valtio";
import { authState, logout } from "@/lib/state-login";

export default function Header() {
  const { user } = useSnapshot(authState);

  if (!user) return null;

  return (
    <Group justify="space-between" px="md" py="sm">
      <Group>
        <Avatar src={user.picture} radius="xl" />
        <Text>{user.name}</Text>
      </Group>
      <Button onClick={logout} color="red" variant="light">
        Logout
      </Button>
    </Group>
  );
}
