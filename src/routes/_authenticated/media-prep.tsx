import { createFileRoute } from "@tanstack/react-router";
import { MediaPrepModule } from "@/components/MediaPrepModule";

export const Route = createFileRoute("/_authenticated/media-prep")({ component: () => <MediaPrepModule /> });
