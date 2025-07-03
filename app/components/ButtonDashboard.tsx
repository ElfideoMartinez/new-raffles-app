import Link from "next/link";

interface ButtonDashboardProps {
  buttonName: string,
  url: string
}
export default function ButtonDashboard ({ buttonName, url}: ButtonDashboardProps) {
  return(
    <Link href={url} className=" bg-blue-500 p-2 rounded-md px-4 w-3/4 sm:w-1/4 text-center">
      {buttonName}
    </Link>
  )
};
