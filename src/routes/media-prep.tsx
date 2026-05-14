import { createFileRoute } from "@tanstack/react-router";
import { MediaPrepModule } from "@/components/MediaPrepModule";

export const Route = createFileRoute("/media-prep")({ component: () => <MediaPrepModule /> });
