import React from "react";
import { createRoot } from "react-dom/client";
import { ThreeApplication } from "./ThreeApplication";
import "../ui/main-ui";

const root = createRoot(document.getElementById("react-root")!);
root.render(<ThreeApplication />);
