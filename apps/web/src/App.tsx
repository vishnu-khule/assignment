import { Route, Routes } from "react-router-dom";
import { SessionPage } from "./pages/SessionPage";
import { SharePage } from "./pages/SharePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SessionPage />} />
      <Route path="/s/:token" element={<SharePage />} />
    </Routes>
  );
}
