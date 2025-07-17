import { proxy } from "valtio";
import {jwtDecode as jwt_decode} from "jwt-decode";

interface User {
  name: string;
  email: string;
  picture: string;
  [key: string]: any;
}

export const authState = proxy<{
  user: User | null;
}>({
  user: null,
});

// Fungsi login dan logout
export const login = (token: string) => {
  localStorage.setItem("token", token);
  const decoded = jwt_decode<User>(token);
  authState.user = decoded;
};

export const logout = () => {
  localStorage.removeItem("token");
  authState.user = null;
};

// Auto load dari localStorage saat awal
const token = localStorage.getItem("token");
if (token) {
  try {
    const decoded = jwt_decode<User>(token);
    authState.user = decoded;
  } catch {}
}
