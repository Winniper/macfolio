import React from 'react'
import { navLinks, navIcons } from '@constants'

import dayjs from 'dayjs'

const Navbar = () => {
  return (
    <nav>
      <div>
        <img src='/images/logo.svg' alt='logo.png' className="invert" />
        <p className='font-bold'>DevBarman's Portfolio</p>
        <ul>
          {navLinks.map(({ id, name }) => (
            <li key={id}>
              <p>{name}</p>
            </li>))}
        </ul>
      </div>
      <div>
        <ul>
          {navIcons.map(({ id, img }) => (
            <li key={id}>
              <img className="icon-hover invert" src={img} alt={`icon-${id}`} />
            </li>
          ))}
        </ul>
        <time>{dayjs().format("ddd MMM D h:mm A")}</time>
      </div>
    </nav>
  )
}

export default Navbar