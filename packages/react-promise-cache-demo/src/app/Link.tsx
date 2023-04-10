import * as React from "react";
import {useNavigate} from "react-router-dom";

export function Link(props) {
  let navigate = useNavigate()

  function onLinkClick(e) {
    React.startTransition(() => {
      e.preventDefault()
      navigate(e.target.getAttribute("href"))
    })
  }

  return <a {...props} onClick={onLinkClick} />
}
