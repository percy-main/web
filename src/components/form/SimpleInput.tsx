type Props = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  label: string;
};

export const SimpleInput: React.FC<Props> = ({ label, ...inputProps }) => {
  if (inputProps.hidden) {
    return <input {...inputProps} name={inputProps.id} />;
  }
  return (
    <div className="group relative z-0 mt-2 mb-5 w-full">
      <input
        {...inputProps}
        name={inputProps.id}
        className="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent text-sm text-gray-900 focus:border-blue-600 focus:ring-0 focus:outline-none dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
        placeholder=" "
      />
      <label
        htmlFor={inputProps.id}
        className="absolute top-3 origin-[0] -translate-y-7 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:start-0 peer-focus:-translate-y-7 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4 dark:text-gray-400 peer-focus:dark:text-blue-500"
      >
        {label}
      </label>
    </div>
  );
};
