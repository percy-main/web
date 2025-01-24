import { SearchParams } from "../SearchParams";
import { SimpleInput } from "./SimpleInput";

type Props = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  param: string;
  label: string;
};

export const SearchFilledInput: React.FC<Props> = ({
  label,
  param,
  ...inputProps
}) => {
  return (
    <SearchParams params={[param]}>
      {(props) => (
        <SimpleInput
          {...inputProps}
          label={label}
          defaultValue={props[param]}
        />
      )}
    </SearchParams>
  );
};
