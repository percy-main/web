type Props<T> = Omit<
  React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >,
  "value" | "onChange" | "defaultValue"
> & {
  id: string;
  options: Array<{
    title: string;
    value: T;
    description?: string;
  }>;
  value: T | undefined;
  onChange: (e: T) => void;
};

export const RadioButtons = <T extends string>({
  options,
  id,
  value,
  ...inputProps
}: Props<T>) => (
  <div className="group relative z-0 mt-2 mb-5 w-full">
    {options.map(({ title, value: radioValue, description }) => {
      return (
        <label
          htmlFor={`${id}-${radioValue}`}
          key={`${id}-${radioValue}`}
          className="mb-4 flex items-center"
        >
          <input
            {...inputProps}
            type="radio"
            id={`${id}-${radioValue}`}
            name={`${id}-${radioValue}`}
            checked={radioValue === value}
            onChange={() => {
              inputProps.onChange(radioValue);
            }}
          />
          <div className="ms-2 font-medium text-gray-900 dark:text-gray-300">
            {title}
            {description && (
              <p
                id="helper-radio-text"
                className="text-xs font-normal text-gray-500 dark:text-gray-300"
              >
                {description}
              </p>
            )}
          </div>
        </label>
      );
    })}
  </div>
);
