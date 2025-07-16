import { BrowserRouter, Routes, Route } from "react-router-dom";
import PageHome from "./pages/PageHome";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
export function App() {
  return (
    <MantineProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PageHome />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}

export default App;
