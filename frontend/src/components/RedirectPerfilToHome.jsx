import { Navigate, useSearchParams } from "react-router-dom";

export default function RedirectPerfilToHome() {
	const [searchParams] = useSearchParams();
	const q = searchParams.toString();
	return <Navigate to={q ? `/?${q}` : "/"} replace />;
}
