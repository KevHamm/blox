import { sampleDocument } from "./data/sampleDocument";
import { DocumentRenderer } from "./renderer/DocumentRenderer";

export default function App() {
  return (
    <div style={{ padding: "40px" }}>
      <DocumentRenderer node={sampleDocument} />
    </div>
  );
}