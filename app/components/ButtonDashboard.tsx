import Link from "next/link";

interface ButtonDashboardProps {
  buttonName: string,
  url: string
}
export default function ButtonDashboard ({ buttonName, url}: ButtonDashboardProps) {
  return(
    <Link href={url} className="focus-ring bg-brand-600 px-4 py-2 w-full text-center text-white rounded-md sm:w-1/4 hover:bg-brand-700">
      {buttonName}
    </Link>
  )
};
