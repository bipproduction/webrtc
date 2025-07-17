import { BrowserRouter, Routes, Route } from "react-router-dom";
import PageHome from "./pages/Home/PageHome";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import ProtectedRoute from "./lib/ProtectedRoute";
import Header from "./lib/Header";
export function App() {
  return (
    <MantineProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Header />
                <PageHome />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}

export default App;
