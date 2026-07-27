import { redirect } from "next/navigation";

/** 가입과 로그인을 나눌 만큼 화면이 많지 않다 — 역할 선택 하나로 합쳤다. */
export default function Page() {
  redirect("/login");
}
