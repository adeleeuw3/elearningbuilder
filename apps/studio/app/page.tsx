import { redirect } from "next/navigation";

/** The workflow canvas is the app's home surface. */
export default function Home() {
  redirect("/workflow");
}
