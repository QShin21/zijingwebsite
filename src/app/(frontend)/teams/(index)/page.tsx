import ContentPage, {
  generateMetadata as contentMetadata,
} from "../../[...path]/page";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ searchParams }: Props) {
  return contentMetadata({
    params: Promise.resolve({ path: ["teams"] }),
    searchParams,
  });
}

export default function TeamsDirectory({ searchParams }: Props) {
  return (
    <ContentPage
      params={Promise.resolve({ path: ["teams"] })}
      searchParams={searchParams}
    />
  );
}
